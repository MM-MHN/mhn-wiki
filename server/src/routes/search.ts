import { Router } from "express";
import { PermissionLevel, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  filterSpacesByAccess,
  getMembershipLevel,
  getUserGroupIds,
  levelAtLeast,
} from "../lib/permissions.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";

export const searchRouter = Router();

const MAX_QUERY = 100;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const SNIPPET_RADIUS = 60;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(text: string, query: string): string {
  const plain = stripHtml(text);
  if (!plain) return "";
  const lower = plain.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) {
    return plain.length > SNIPPET_RADIUS * 2
      ? `${plain.slice(0, SNIPPET_RADIUS * 2)}…`
      : plain;
  }
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(plain.length, idx + q.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < plain.length ? "…" : "";
  return `${prefix}${plain.slice(start, end)}${suffix}`;
}

function scoreMatch(haystack: string, query: string): number {
  const h = haystack.toLowerCase();
  const q = query.toLowerCase();
  if (!h || !q) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  if (h.includes(q)) return 50;
  return 0;
}

type RankedPage = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  updatedAt: Date;
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
  snippet: string;
  matchField: "title" | "slug" | "content";
};

function rankPages(
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    content: string;
    published: boolean;
    updatedAt: Date;
    space: { id: string; name: string; slug: string };
  }>,
  raw: string,
  limit: number
): RankedPage[] {
  return pages
    .map((page) => {
      const titleScore = scoreMatch(page.title, raw);
      const slugScore = scoreMatch(page.slug, raw);
      const contentPlain = stripHtml(page.content);
      const contentScore = scoreMatch(contentPlain, raw) * 0.6;
      const score = Math.max(titleScore, slugScore, contentScore);
      const matchInTitle = titleScore > 0;
      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        published: page.published,
        updatedAt: page.updatedAt,
        spaceId: page.space.id,
        spaceName: page.space.name,
        spaceSlug: page.space.slug,
        snippet: matchInTitle
          ? makeSnippet(page.title, raw)
          : makeSnippet(page.content, raw) || makeSnippet(page.slug, raw),
        matchField: (matchInTitle
          ? "title"
          : slugScore > contentScore
            ? "slug"
            : "content") as RankedPage["matchField"],
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...rest }) => rest);
}

searchRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const raw = String(req.query.q ?? "").trim();
    if (!raw) {
      res.json({ query: "", spaces: [], pages: [] });
      return;
    }
    if (raw.length > MAX_QUERY) {
      throw new AppError(
        400,
        `Search query must be at most ${MAX_QUERY} characters`
      );
    }

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT)
    );

    const allSpaces = await prisma.space.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        isPrivate: true,
      },
    });

    const accessible = await filterSpacesByAccess(req.user!, allSpaces);
    if (!accessible.length) {
      res.json({ query: raw, spaces: [], pages: [] });
      return;
    }

    const spaceMatches = accessible
      .map((space) => {
        const nameScore = scoreMatch(space.name, raw);
        const slugScore = scoreMatch(space.slug, raw);
        const desc = space.description || "";
        const descScore = scoreMatch(desc, raw);
        const score = Math.max(nameScore, slugScore, descScore * 0.7);
        if (score <= 0) return null;
        return {
          id: space.id,
          name: space.name,
          slug: space.slug,
          description: space.description,
          icon: space.icon,
          snippet:
            descScore > 0 ? makeSnippet(desc, raw) : space.description || "",
          score,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _s, ...rest }) => rest);

    const isAdmin = req.user!.role === Role.ADMIN;
    const textMatch: Prisma.PageWhereInput = {
      OR: [
        { title: { contains: raw, mode: "insensitive" } },
        { slug: { contains: raw, mode: "insensitive" } },
        { content: { contains: raw, mode: "insensitive" } },
      ],
    };

    let visibility: Prisma.PageWhereInput;

    if (isAdmin) {
      visibility = { spaceId: { in: accessible.map((s) => s.id) } };
    } else {
      const groupIds = await getUserGroupIds(req.user!.id);
      const editableSpaceIds: string[] = [];
      const viewOnlySpaceIds: string[] = [];

      for (const space of accessible) {
        const level = await getMembershipLevel(
          req.user!.id,
          space.id,
          groupIds
        );
        if (
          req.user!.role === Role.EDITOR &&
          levelAtLeast(level, PermissionLevel.EDIT)
        ) {
          editableSpaceIds.push(space.id);
        } else {
          viewOnlySpaceIds.push(space.id);
        }
      }

      const orSpace: Prisma.PageWhereInput[] = [];
      if (editableSpaceIds.length) {
        orSpace.push({ spaceId: { in: editableSpaceIds } });
      }
      if (viewOnlySpaceIds.length) {
        orSpace.push({
          spaceId: { in: viewOnlySpaceIds },
          published: true,
        });
      }
      if (!orSpace.length) {
        res.json({ query: raw, spaces: spaceMatches, pages: [] });
        return;
      }
      visibility = { OR: orSpace };
    }

    const pages = await prisma.page.findMany({
      where: { AND: [visibility, textMatch] },
      take: limit * 2,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        published: true,
        updatedAt: true,
        space: { select: { id: true, name: true, slug: true } },
      },
    });

    res.json({
      query: raw,
      spaces: spaceMatches,
      pages: rankPages(pages, raw, limit),
    });
  })
);

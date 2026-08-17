import { Router } from "express";
import { z } from "zod";
import { PermissionLevel, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/params.js";
import {
  assertSpaceAccess,
  filterSpacesByAccess,
  getSpaceAccessLevel,
  levelAtLeast,
} from "../lib/permissions.js";
import { actorFromRequest, logSystemEvent } from "../lib/systemLog.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const spacesRouter = Router();

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

spacesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const spaces = await prisma.space.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { pages: true } },
      },
    });

    const filtered = await filterSpacesByAccess(req.user!, spaces);
    const withAccess = await Promise.all(
      filtered.map(async (space) => ({
        ...space,
        myAccess: await getSpaceAccessLevel(req.user!, space),
      }))
    );

    res.json({ spaces: withAccess });
  })
);

spacesRouter.get(
  "/:slug",
  requireAuth,
  asyncHandler(async (req, res) => {
    const slug = param(req, "slug");
    const space = await prisma.space.findUnique({
      where: { slug },
      include: {
        pages: {
          orderBy: [{ order: "asc" }, { title: "asc" }],
          select: {
            id: true,
            title: true,
            slug: true,
            parentId: true,
            order: true,
            editorType: true,
            published: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!space) throw new AppError(404, "Space not found");

    const myAccess = await assertSpaceAccess(
      req.user!,
      space,
      PermissionLevel.VIEW
    );
    const canSeeDrafts = levelAtLeast(myAccess, PermissionLevel.EDIT);

    const pages = canSeeDrafts
      ? space.pages
      : space.pages.filter((p) => p.published);

    res.json({
      space: {
        ...space,
        pages,
        myAccess,
      },
    });
  })
);

const spaceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

spacesRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = spaceSchema.parse(req.body);
    const slug = body.slug ? slugify(body.slug) : slugify(body.name);

    const space = await prisma.space.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        icon: body.icon || "book",
        isPrivate: body.isPrivate ?? false,
        members: {
          create: {
            userId: req.user!.id,
            level: PermissionLevel.MANAGE,
          },
        },
      },
    });

    logSystemEvent({
      category: "SPACE",
      action: "space.created",
      message: `Created space “${space.name}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "space", id: space.id, label: space.name },
      metadata: { slug: space.slug, isPrivate: space.isPrivate },
    });

    res.status(201).json({ space: { ...space, myAccess: PermissionLevel.MANAGE } });
  })
);

spacesRouter.patch(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = spaceSchema.partial().parse(req.body);
    const existing = await prisma.space.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Space not found");

    const space = await prisma.space.update({
      where: { id },
      data: {
        ...body,
        slug: body.slug ? slugify(body.slug) : undefined,
      },
    });

    logSystemEvent({
      category: "SPACE",
      action: "space.updated",
      message: `Updated space “${space.name}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "space", id: space.id, label: space.name },
      metadata: { slug: space.slug, isPrivate: space.isPrivate },
    });

    res.json({ space });
  })
);

spacesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const existing = await prisma.space.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Space not found");

    await prisma.space.delete({ where: { id } });

    logSystemEvent({
      category: "SPACE",
      action: "space.deleted",
      message: `Deleted space “${existing.name}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "space", id: existing.id, label: existing.name },
      metadata: { slug: existing.slug },
    });

    res.status(204).send();
  })
);

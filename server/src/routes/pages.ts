import { Router } from "express";
import { z } from "zod";
import { EditorType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/params.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";

export const pagesRouter = Router();

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

pagesRouter.get(
  "/by-path/:spaceSlug/:pageSlug",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const spaceSlug = param(req, "spaceSlug");
    const pageSlug = param(req, "pageSlug");

    const space = await prisma.space.findUnique({
      where: { slug: spaceSlug },
    });
    if (!space) throw new AppError(404, "Space not found");
    if (space.isPrivate && !req.user) {
      throw new AppError(401, "Sign in required");
    }

    const page = await prisma.page.findFirst({
      where: { spaceId: space.id, slug: pageSlug },
      include: {
        author: { select: { id: true, name: true, email: true } },
        space: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!page || (!page.published && req.user?.role === Role.VIEWER)) {
      throw new AppError(404, "Page not found");
    }

    res.json({ page });
  })
);

pagesRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        space: { select: { id: true, name: true, slug: true, isPrivate: true } },
        permissions: true,
      },
    });
    if (!page) throw new AppError(404, "Page not found");
    if (page.space.isPrivate && !req.user) {
      throw new AppError(401, "Sign in required");
    }
    res.json({ page });
  })
);

const pageSchema = z.object({
  spaceId: z.string(),
  parentId: z.string().nullable().optional(),
  title: z.string().min(1),
  slug: z.string().optional(),
  content: z.string().optional(),
  editorType: z.nativeEnum(EditorType).optional(),
  published: z.boolean().optional(),
  order: z.number().int().optional(),
});

pagesRouter.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN, Role.EDITOR),
  asyncHandler(async (req, res) => {
    const body = pageSchema.parse(req.body);
    const slug = body.slug ? slugify(body.slug) : slugify(body.title);

    const page = await prisma.page.create({
      data: {
        spaceId: body.spaceId,
        parentId: body.parentId ?? null,
        title: body.title,
        slug,
        content: body.content ?? "",
        editorType: body.editorType ?? EditorType.MARKDOWN,
        published: body.published ?? true,
        order: body.order ?? 0,
        authorId: req.user!.id,
      },
    });

    res.status(201).json({ page });
  })
);

pagesRouter.patch(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN, Role.EDITOR),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = pageSchema.partial().omit({ spaceId: true }).parse(req.body);
    const page = await prisma.page.update({
      where: { id },
      data: {
        ...body,
        slug: body.slug ? slugify(body.slug) : undefined,
      },
    });
    res.json({ page });
  })
);

pagesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN, Role.EDITOR),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    await prisma.page.delete({ where: { id } });
    res.status(204).send();
  })
);

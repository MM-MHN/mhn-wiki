import { Router } from "express";
import { z } from "zod";
import { EditorType, PageRevisionAction, PermissionLevel, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/params.js";
import {
  recordPageRevision,
  revisionListSelect,
} from "../lib/pageHistory.js";
import {
  assertSpaceAccess,
  canAccessUnpublishedPage,
  canManagePageVisibility,
} from "../lib/permissions.js";
import { actorFromRequest, logSystemEvent } from "../lib/systemLog.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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
  requireAuth,
  asyncHandler(async (req, res) => {
    const spaceSlug = param(req, "spaceSlug");
    const pageSlug = param(req, "pageSlug");

    const space = await prisma.space.findUnique({
      where: { slug: spaceSlug },
    });
    if (!space) throw new AppError(404, "Space not found");

    const access = await assertSpaceAccess(
      req.user!,
      space,
      PermissionLevel.VIEW
    );

    const page = await prisma.page.findFirst({
      where: {
        spaceId: space.id,
        slug: pageSlug,
        // Non-admins cannot retrieve hidden topics via reader API
        ...(req.user!.role === Role.ADMIN ? {} : { published: true }),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        space: {
          select: { id: true, name: true, slug: true, isPrivate: true },
        },
      },
    });

    if (!page) throw new AppError(404, "Page not found");

    res.json({ page, myAccess: access });
  })
);

pagesRouter.get(
  "/:id/history",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, isPrivate: true } },
      },
    });
    if (!page) throw new AppError(404, "Page not found");

    const access = await assertSpaceAccess(
      req.user!,
      page.space,
      PermissionLevel.VIEW
    );

    if (
      !page.published &&
      !canAccessUnpublishedPage(req.user!, access, "edit")
    ) {
      throw new AppError(404, "Page not found");
    }

    const revisions = await prisma.pageRevision.findMany({
      where: { pageId: id },
      orderBy: { createdAt: "desc" },
      select: revisionListSelect,
    });

    res.json({ revisions });
  })
);

pagesRouter.get(
  "/:id/history/:revisionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const revisionId = param(req, "revisionId");

    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, isPrivate: true } },
      },
    });
    if (!page) throw new AppError(404, "Page not found");

    const access = await assertSpaceAccess(
      req.user!,
      page.space,
      PermissionLevel.VIEW
    );

    if (
      !page.published &&
      !canAccessUnpublishedPage(req.user!, access, "edit")
    ) {
      throw new AppError(404, "Page not found");
    }

    const revision = await prisma.pageRevision.findFirst({
      where: { id: revisionId, pageId: id },
      include: {
        editedBy: { select: { id: true, name: true, username: true } },
      },
    });
    if (!revision) throw new AppError(404, "Revision not found");

    res.json({ revision });
  })
);

pagesRouter.post(
  "/:id/history/:revisionId/restore",
  requireAuth,
  requireRole(Role.ADMIN, Role.EDITOR),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const revisionId = param(req, "revisionId");

    const existing = await prisma.page.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, isPrivate: true } },
      },
    });
    if (!existing) throw new AppError(404, "Page not found");

    await assertSpaceAccess(req.user!, existing.space, PermissionLevel.EDIT);

    const revision = await prisma.pageRevision.findFirst({
      where: { id: revisionId, pageId: id },
    });
    if (!revision) throw new AppError(404, "Revision not found");

    const page = await prisma.$transaction(async (tx) => {
      const updated = await tx.page.update({
        where: { id },
        data: {
          title: revision.title,
          slug: revision.slug,
          content: revision.content,
          editorType: revision.editorType,
          // Only ADMIN may change visibility via restore
          published: canManagePageVisibility(req.user!)
            ? revision.published
            : existing.published,
          parentId: revision.parentId,
          order: revision.order,
          authorId: req.user!.id,
        },
      });

      await recordPageRevision(
        updated,
        PageRevisionAction.RESTORED,
        req.user!.id,
        tx
      );

      return updated;
    });

    logSystemEvent({
      category: "PAGE",
      action: "page.restored",
      message: `Restored page “${page.title}” from history`,
      actor: actorFromRequest(req.user!),
      target: { type: "page", id: page.id, label: page.title },
      metadata: { revisionId },
    });

    res.json({ page });
  })
);

pagesRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        space: {
          select: { id: true, name: true, slug: true, isPrivate: true },
        },
        permissions: true,
      },
    });
    if (!page) throw new AppError(404, "Page not found");

    const access = await assertSpaceAccess(
      req.user!,
      page.space,
      PermissionLevel.VIEW
    );

    if (
      !page.published &&
      !canAccessUnpublishedPage(req.user!, access, "edit")
    ) {
      throw new AppError(404, "Page not found");
    }

    res.json({ page, myAccess: access });
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

    const space = await prisma.space.findUnique({ where: { id: body.spaceId } });
    if (!space) throw new AppError(404, "Space not found");

    await assertSpaceAccess(req.user!, space, PermissionLevel.EDIT);

    if (body.published !== undefined && !canManagePageVisibility(req.user!)) {
      throw new AppError(
        403,
        "Only admins can publish or hide space content"
      );
    }

    const published = canManagePageVisibility(req.user!)
      ? (body.published ?? false)
      : false;

    const page = await prisma.$transaction(async (tx) => {
      const created = await tx.page.create({
        data: {
          spaceId: body.spaceId,
          parentId: body.parentId ?? null,
          title: body.title,
          slug,
          content: body.content ?? "",
          editorType: body.editorType ?? EditorType.MARKDOWN,
          published,
          order: body.order ?? 0,
          authorId: req.user!.id,
        },
      });

      await recordPageRevision(
        created,
        PageRevisionAction.CREATED,
        req.user!.id,
        tx
      );

      return created;
    });

    logSystemEvent({
      category: "PAGE",
      action: "page.created",
      message: `Created page “${page.title}”${page.published ? "" : " (hidden)"}`,
      actor: actorFromRequest(req.user!),
      target: { type: "page", id: page.id, label: page.title },
      metadata: {
        spaceId: page.spaceId,
        slug: page.slug,
        published: page.published,
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

    const existing = await prisma.page.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, isPrivate: true } },
      },
    });
    if (!existing) throw new AppError(404, "Page not found");

    await assertSpaceAccess(req.user!, existing.space, PermissionLevel.EDIT);

    if (body.published !== undefined && !canManagePageVisibility(req.user!)) {
      throw new AppError(
        403,
        "Only admins can publish or hide space content"
      );
    }

    const data = {
      ...body,
      slug: body.slug ? slugify(body.slug) : undefined,
      authorId: req.user!.id,
      ...(canManagePageVisibility(req.user!)
        ? {}
        : { published: undefined }),
    };

    const page = await prisma.$transaction(async (tx) => {
      const updated = await tx.page.update({
        where: { id },
        data,
      });

      await recordPageRevision(
        updated,
        PageRevisionAction.UPDATED,
        req.user!.id,
        tx
      );

      return updated;
    });

    const visibilityChanged =
      body.published !== undefined && body.published !== existing.published;

    logSystemEvent({
      category: "PAGE",
      action: visibilityChanged
        ? body.published
          ? "page.published"
          : "page.hidden"
        : "page.updated",
      message: visibilityChanged
        ? body.published
          ? `Published page “${page.title}”`
          : `Hid page “${page.title}”`
        : `Updated page “${page.title}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "page", id: page.id, label: page.title },
      metadata: { slug: page.slug, published: page.published },
    });

    res.json({ page });
  })
);

pagesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const existing = await prisma.page.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, isPrivate: true } },
      },
    });
    if (!existing) throw new AppError(404, "Page not found");

    await assertSpaceAccess(req.user!, existing.space, PermissionLevel.MANAGE);

    // Permanent hard delete — cascades revisions & page permissions
    await prisma.page.delete({ where: { id } });

    logSystemEvent({
      category: "PAGE",
      action: "page.deleted",
      message: `Permanently deleted page “${existing.title}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "page", id: existing.id, label: existing.title },
      metadata: { spaceId: existing.spaceId, slug: existing.slug },
    });

    res.status(204).send();
  })
);

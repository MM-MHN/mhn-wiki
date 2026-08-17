import { Router } from "express";
import { z } from "zod";
import { PermissionLevel, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/params.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
export const spacesRouter = Router();
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
spacesRouter.get("/", requireAuth, asyncHandler(async (req, res) => {
    const spaces = await prisma.space.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: { select: { pages: true } },
        },
    });
    const isAdmin = req.user.role === Role.ADMIN;
    const filtered = isAdmin
        ? spaces
        : spaces.filter((s) => !s.isPrivate);
    res.json({ spaces: filtered });
}));
spacesRouter.get("/:slug", requireAuth, asyncHandler(async (req, res) => {
    const slug = param(req, "slug");
    const canSeeDrafts = req.user.role === Role.ADMIN || req.user.role === Role.EDITOR;
    const space = await prisma.space.findUnique({
        where: { slug },
        include: {
            pages: {
                where: canSeeDrafts ? undefined : { published: true },
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
    if (!space)
        throw new AppError(404, "Space not found");
    if (space.isPrivate && req.user.role !== Role.ADMIN) {
        throw new AppError(403, "You do not have access to this space");
    }
    res.json({ space });
}));
const spaceSchema = z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    isPrivate: z.boolean().optional(),
});
spacesRouter.post("/", requireAuth, requireRole(Role.ADMIN), asyncHandler(async (req, res) => {
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
                    userId: req.user.id,
                    level: PermissionLevel.MANAGE,
                },
            },
        },
    });
    res.status(201).json({ space });
}));
spacesRouter.patch("/:id", requireAuth, requireRole(Role.ADMIN), asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = spaceSchema.partial().parse(req.body);
    const space = await prisma.space.update({
        where: { id },
        data: {
            ...body,
            slug: body.slug ? slugify(body.slug) : undefined,
        },
    });
    res.json({ space });
}));
spacesRouter.delete("/:id", requireAuth, requireRole(Role.ADMIN), asyncHandler(async (req, res) => {
    const id = param(req, "id");
    await prisma.space.delete({ where: { id } });
    res.status(204).send();
}));

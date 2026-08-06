import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/params.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(Role.ADMIN));

const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  groupMembers: {
    include: { group: { select: { id: true, name: true } } },
  },
} as const;

const groupInclude = {
  members: {
    include: {
      user: { select: { id: true, name: true, username: true, email: true } },
    },
  },
  _count: { select: { members: true } },
} as const;

const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores");


adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [users, groups, spaces, pages] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.space.count(),
      prisma.page.count(),
    ]);
    res.json({ stats: { users, groups, spaces, pages } });
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: userSelect,
    });
    res.json({ users });
  })
);

const userCreateSchema = z.object({
  username: usernameSchema,
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.nativeEnum(Role).optional(),
  groupIds: z.array(z.string()).optional(),
});

adminRouter.post(
  "/users",
  asyncHandler(async (req, res) => {
    const body = userCreateSchema.parse(req.body);
    const username = body.username.toLowerCase();
    const email = body.email?.trim() ? body.email.trim() : null;

    const usernameTaken = await prisma.user.findUnique({ where: { username } });
    if (usernameTaken) throw new AppError(409, "Username already in use");

    if (email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) throw new AppError(409, "Email already in use");
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        name: body.name,
        role: body.role ?? Role.VIEWER,
        passwordHash: await bcrypt.hash(body.password, 10),
        groupMembers: body.groupIds?.length
          ? { create: body.groupIds.map((groupId) => ({ groupId })) }
          : undefined,
      },
      select: userSelect,
    });
    res.status(201).json({ user });
  })
);

adminRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = z
      .object({
        username: usernameSchema.optional(),
        email: z.string().email().optional().or(z.literal("")).nullable(),
        name: z.string().min(1).optional(),
        role: z.nativeEnum(Role).optional(),
        password: z.string().min(6).optional(),
        groupIds: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "User not found");

    const username = body.username?.toLowerCase();
    if (username && username !== existing.username) {
      const taken = await prisma.user.findUnique({ where: { username } });
      if (taken) throw new AppError(409, "Username already in use");
    }

    const email =
      body.email === undefined
        ? undefined
        : body.email === null || body.email === ""
          ? null
          : body.email.trim();

    if (email && email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) throw new AppError(409, "Email already in use");
    }

    // Prevent removing the last admin
    if (body.role && body.role !== Role.ADMIN && existing.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new AppError(400, "Cannot demote the last admin");
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      if (body.groupIds) {
        await tx.groupMember.deleteMany({ where: { userId: id } });
        if (body.groupIds.length) {
          await tx.groupMember.createMany({
            data: body.groupIds.map((groupId) => ({ userId: id, groupId })),
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          username,
          email,
          name: body.name,
          role: body.role,
          passwordHash: body.password
            ? await bcrypt.hash(body.password, 10)
            : undefined,
        },
        select: userSelect,
      });
    });

    res.json({ user });
  })
);

adminRouter.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    if (req.user?.id === id) {
      throw new AppError(400, "You cannot delete your own account");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "User not found");

    if (existing.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new AppError(400, "Cannot delete the last admin");
      }
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  })
);

adminRouter.get(
  "/groups",
  asyncHandler(async (_req, res) => {
    const groups = await prisma.group.findMany({
      orderBy: { name: "asc" },
      include: groupInclude,
    });
    res.json({ groups });
  })
);

adminRouter.post(
  "/groups",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        memberIds: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const exists = await prisma.group.findUnique({ where: { name: body.name } });
    if (exists) throw new AppError(409, "Group name already exists");

    const group = await prisma.group.create({
      data: {
        name: body.name,
        description: body.description,
        members: body.memberIds?.length
          ? { create: body.memberIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: groupInclude,
    });
    res.status(201).json({ group });
  })
);

adminRouter.patch(
  "/groups/:id",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        memberIds: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Group not found");

    if (body.name && body.name !== existing.name) {
      const taken = await prisma.group.findUnique({ where: { name: body.name } });
      if (taken) throw new AppError(409, "Group name already exists");
    }

    const group = await prisma.$transaction(async (tx) => {
      if (body.memberIds) {
        await tx.groupMember.deleteMany({ where: { groupId: id } });
        if (body.memberIds.length) {
          await tx.groupMember.createMany({
            data: body.memberIds.map((userId) => ({ groupId: id, userId })),
          });
        }
      }

      return tx.group.update({
        where: { id },
        data: {
          name: body.name,
          description:
            body.description === undefined ? undefined : body.description,
        },
        include: groupInclude,
      });
    });

    res.json({ group });
  })
);

adminRouter.delete(
  "/groups/:id",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Group not found");
    await prisma.group.delete({ where: { id } });
    res.status(204).send();
  })
);

adminRouter.get(
  "/spaces",
  asyncHandler(async (_req, res) => {
    const spaces = await prisma.space.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { pages: true, members: true } },
        pages: {
          orderBy: [{ order: "asc" }, { title: "asc" }],
          select: {
            id: true,
            title: true,
            slug: true,
            parentId: true,
            published: true,
            editorType: true,
            updatedAt: true,
          },
        },
      },
    });
    res.json({ spaces });
  })
);

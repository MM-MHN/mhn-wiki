import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PermissionLevel, Role, SystemLogCategory } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/params.js";
import { actorFromRequest, logSystemEvent } from "../lib/systemLog.js";
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
  "/logs",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        category: z.nativeEnum(SystemLogCategory).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        q: z.string().optional(),
      })
      .parse(req.query);

    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { message: { contains: query.q, mode: "insensitive" as const } },
              { targetLabel: { contains: query.q, mode: "insensitive" as const } },
              { actorName: { contains: query.q, mode: "insensitive" as const } },
              { action: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.systemLog.count({ where }),
    ]);

    res.json({ logs, total, limit: query.limit, offset: query.offset });
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
    logSystemEvent({
      category: "USER",
      action: "user.created",
      message: `Created user “${user.name}” (@${user.username}) as ${user.role}`,
      actor: actorFromRequest(req.user!),
      target: { type: "user", id: user.id, label: user.name },
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

    logSystemEvent({
      category: "USER",
      action: "user.updated",
      message: `Updated user “${user.name}” (@${user.username})`,
      actor: actorFromRequest(req.user!),
      target: { type: "user", id: user.id, label: user.name },
      metadata: { role: user.role },
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

    logSystemEvent({
      category: "USER",
      action: "user.deleted",
      message: `Deleted user “${existing.name}” (@${existing.username})`,
      actor: actorFromRequest(req.user!),
      target: { type: "user", id: existing.id, label: existing.name },
    });

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
    logSystemEvent({
      category: "GROUP",
      action: "group.created",
      message: `Created group “${group.name}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "group", id: group.id, label: group.name },
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

    logSystemEvent({
      category: "GROUP",
      action: "group.updated",
      message: `Updated group “${group.name}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "group", id: group.id, label: group.name },
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

    logSystemEvent({
      category: "GROUP",
      action: "group.deleted",
      message: `Deleted group “${existing.name}”`,
      actor: actorFromRequest(req.user!),
      target: { type: "group", id: existing.id, label: existing.name },
    });

    res.status(204).send();
  })
);

const spaceMemberInclude = {
  user: { select: { id: true, name: true, username: true, role: true } },
  group: { select: { id: true, name: true } },
} as const;

adminRouter.get(
  "/spaces",
  asyncHandler(async (_req, res) => {
    const spaces = await prisma.space.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { pages: true, members: true } },
        members: {
          include: spaceMemberInclude,
          orderBy: { id: "asc" },
        },
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

adminRouter.get(
  "/spaces/:id/members",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const space = await prisma.space.findUnique({ where: { id } });
    if (!space) throw new AppError(404, "Space not found");

    const members = await prisma.spaceMember.findMany({
      where: { spaceId: id },
      include: spaceMemberInclude,
      orderBy: { id: "asc" },
    });
    res.json({ members });
  })
);

const spaceMemberSchema = z
  .object({
    userId: z.string().optional(),
    groupId: z.string().optional(),
    level: z.nativeEnum(PermissionLevel).default(PermissionLevel.VIEW),
  })
  .refine((d) => Boolean(d.userId) !== Boolean(d.groupId), {
    message: "Provide exactly one of userId or groupId",
  });

adminRouter.post(
  "/spaces/:id/members",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = spaceMemberSchema.parse(req.body);

    const space = await prisma.space.findUnique({ where: { id } });
    if (!space) throw new AppError(404, "Space not found");

    if (body.userId) {
      const user = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!user) throw new AppError(404, "User not found");
      const existing = await prisma.spaceMember.findFirst({
        where: { spaceId: id, userId: body.userId },
      });
      if (existing) throw new AppError(409, "User already has access to this space");
    }

    if (body.groupId) {
      const group = await prisma.group.findUnique({
        where: { id: body.groupId },
      });
      if (!group) throw new AppError(404, "Group not found");
      const existing = await prisma.spaceMember.findFirst({
        where: { spaceId: id, groupId: body.groupId },
      });
      if (existing) throw new AppError(409, "Group already has access to this space");
    }

    const member = await prisma.spaceMember.create({
      data: {
        spaceId: id,
        userId: body.userId ?? null,
        groupId: body.groupId ?? null,
        level: body.level,
      },
      include: spaceMemberInclude,
    });

    const subject =
      member.user?.name ?? member.group?.name ?? "member";
    logSystemEvent({
      category: "ACCESS",
      action: "space.access.granted",
      message: `Granted ${body.level} on “${space.name}” to ${subject}`,
      actor: actorFromRequest(req.user!),
      target: { type: "space", id: space.id, label: space.name },
      metadata: {
        memberId: member.id,
        level: body.level,
        userId: body.userId,
        groupId: body.groupId,
      },
    });

    res.status(201).json({ member });
  })
);

adminRouter.patch(
  "/spaces/:spaceId/members/:memberId",
  asyncHandler(async (req, res) => {
    const spaceId = param(req, "spaceId");
    const memberId = param(req, "memberId");
    const body = z
      .object({ level: z.nativeEnum(PermissionLevel) })
      .parse(req.body);

    const existing = await prisma.spaceMember.findFirst({
      where: { id: memberId, spaceId },
      include: { space: true, user: true, group: true },
    });
    if (!existing) throw new AppError(404, "Space member not found");

    const member = await prisma.spaceMember.update({
      where: { id: memberId },
      data: { level: body.level },
      include: spaceMemberInclude,
    });

    const subject =
      member.user?.name ?? member.group?.name ?? "member";
    logSystemEvent({
      category: "ACCESS",
      action: "space.access.updated",
      message: `Changed access on “${existing.space.name}” for ${subject} to ${body.level}`,
      actor: actorFromRequest(req.user!),
      target: {
        type: "space",
        id: existing.space.id,
        label: existing.space.name,
      },
      metadata: { memberId, level: body.level },
    });

    res.json({ member });
  })
);

adminRouter.delete(
  "/spaces/:spaceId/members/:memberId",
  asyncHandler(async (req, res) => {
    const spaceId = param(req, "spaceId");
    const memberId = param(req, "memberId");

    const existing = await prisma.spaceMember.findFirst({
      where: { id: memberId, spaceId },
      include: { space: true, user: true, group: true },
    });
    if (!existing) throw new AppError(404, "Space member not found");

    await prisma.spaceMember.delete({ where: { id: memberId } });

    const subject = existing.user?.name ?? existing.group?.name ?? "member";
    logSystemEvent({
      category: "ACCESS",
      action: "space.access.revoked",
      message: `Revoked access on “${existing.space.name}” from ${subject}`,
      actor: actorFromRequest(req.user!),
      target: {
        type: "space",
        id: existing.space.id,
        label: existing.space.name,
      },
      metadata: { memberId },
    });

    res.status(204).send();
  })
);

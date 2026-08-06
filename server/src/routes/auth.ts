import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { requireAuth, signToken, toAuthUser } from "../middleware/auth.js";

export const authRouter = Router();

const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores");

const credentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    const username = body.username.toLowerCase();
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new AppError(401, "Invalid username or password");

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw new AppError(401, "Invalid username or password");

    const authUser = toAuthUser(user);
    res.json({
      token: signToken(authUser),
      user: authUser,
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        groupMembers: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
    });
    res.json({ user });
  })
);

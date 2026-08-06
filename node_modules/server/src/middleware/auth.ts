import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { AppError } from "./error.js";
import { prisma } from "../lib/prisma.js";

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const jwtSecret = () => process.env.JWT_SECRET || "dev-secret";

export function toAuthUser(user: {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: Role;
}): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function signToken(user: AuthUser) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    jwtSecret(),
    { expiresIn: "7d" }
  );
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as AuthUser;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (user) req.user = toAuthUser(user);
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as AuthUser;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return next(new AppError(401, "Invalid session"));
    req.user = toAuthUser(user);
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions"));
    }
    next();
  };
}

import jwt from "jsonwebtoken";
import { AppError } from "./error.js";
import { prisma } from "../lib/prisma.js";
const jwtSecret = () => process.env.JWT_SECRET || "dev-secret";
export function toAuthUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
    };
}
export function signToken(user) {
    return jwt.sign({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
    }, jwtSecret(), { expiresIn: "7d" });
}
export async function optionalAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return next();
    try {
        const payload = jwt.verify(header.slice(7), jwtSecret());
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (user)
            req.user = toAuthUser(user);
    }
    catch {
        // ignore invalid token for optional auth
    }
    next();
}
export async function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return next(new AppError(401, "Authentication required"));
    }
    try {
        const payload = jwt.verify(header.slice(7), jwtSecret());
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user)
            return next(new AppError(401, "Invalid session"));
        req.user = toAuthUser(user);
        next();
    }
    catch {
        next(new AppError(401, "Invalid or expired token"));
    }
}
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new AppError(401, "Authentication required"));
        if (!roles.includes(req.user.role)) {
            return next(new AppError(403, "Insufficient permissions"));
        }
        next();
    };
}

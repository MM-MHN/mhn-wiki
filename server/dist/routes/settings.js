import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
export const settingsRouter = Router();
settingsRouter.get("/", asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ settings });
}));
settingsRouter.put("/", requireAuth, requireRole(Role.ADMIN), asyncHandler(async (req, res) => {
    const body = z.record(z.string()).parse(req.body);
    await Promise.all(Object.entries(body).map(([key, value]) => prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
    })));
    const rows = await prisma.setting.findMany();
    res.json({
        settings: Object.fromEntries(rows.map((r) => [r.key, r.value])),
    });
}));

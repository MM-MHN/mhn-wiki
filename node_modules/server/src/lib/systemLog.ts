import type { Role, SystemLogCategory } from "@prisma/client";
import { prisma } from "./prisma.js";

export type SystemLogActor = {
  id: string;
  name: string;
  role: Role;
};

export type SystemLogTarget = {
  type: string;
  id: string;
  label: string;
};

export function logSystemEvent(input: {
  category: SystemLogCategory;
  action: string;
  message: string;
  actor?: SystemLogActor | null;
  target?: SystemLogTarget | null;
  metadata?: Record<string, unknown>;
}) {
  void prisma.systemLog
    .create({
      data: {
        category: input.category,
        action: input.action,
        message: input.message,
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? null,
        actorRole: input.actor?.role ?? null,
        targetType: input.target?.type ?? null,
        targetId: input.target?.id ?? null,
        targetLabel: input.target?.label ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    })
    .catch((err) => {
      console.error("Failed to write system log:", err);
    });
}

export function actorFromRequest(user?: {
  id: string;
  name: string;
  role: Role;
}): SystemLogActor | null {
  if (!user) return null;
  return { id: user.id, name: user.name, role: user.role };
}

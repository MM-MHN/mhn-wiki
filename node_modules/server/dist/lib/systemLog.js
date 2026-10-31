import { prisma } from "./prisma.js";
export function logSystemEvent(input) {
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
export function actorFromRequest(user) {
    if (!user)
        return null;
    return { id: user.id, name: user.name, role: user.role };
}

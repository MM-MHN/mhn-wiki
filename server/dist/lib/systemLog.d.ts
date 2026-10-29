import type { Role, SystemLogCategory } from "@prisma/client";
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
export declare function logSystemEvent(input: {
    category: SystemLogCategory;
    action: string;
    message: string;
    actor?: SystemLogActor | null;
    target?: SystemLogTarget | null;
    metadata?: Record<string, unknown>;
}): void;
export declare function actorFromRequest(user?: {
    id: string;
    name: string;
    role: Role;
}): SystemLogActor | null;

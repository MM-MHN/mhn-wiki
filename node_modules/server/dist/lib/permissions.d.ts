import { PermissionLevel, Role, type Space } from "@prisma/client";
export declare function maxLevel(a: PermissionLevel, b: PermissionLevel): PermissionLevel;
export declare function levelAtLeast(level: PermissionLevel, required: PermissionLevel): boolean;
export declare function getUserGroupIds(userId: string): Promise<string[]>;
/** Highest SpaceMember level for this user (direct or via group). */
export declare function getMembershipLevel(userId: string, spaceId: string, groupIds?: string[]): Promise<PermissionLevel>;
/**
 * Effective access for a space:
 * - ADMIN always MANAGE
 * - Everyone else: only via SpaceMember (direct user or group membership)
 */
export declare function getSpaceAccessLevel(user: {
    id: string;
    role: Role;
}, space: Pick<Space, "id" | "isPrivate">): Promise<PermissionLevel>;
export declare function assertSpaceAccess(user: {
    id: string;
    role: Role;
}, space: Pick<Space, "id" | "isPrivate">, required?: PermissionLevel): Promise<PermissionLevel>;
export declare function filterSpacesByAccess<T extends Pick<Space, "id" | "isPrivate">>(user: {
    id: string;
    role: Role;
}, spaces: T[]): Promise<T[]>;
/** Publish / hide visibility may only be changed by ADMIN. */
export declare function canManagePageVisibility(user: {
    role: Role;
}): boolean;
/**
 * Who may load an unpublished (hidden) page:
 * - ADMIN: always (space viewer + CMS)
 * - EDITOR with EDIT access: CMS only (get-by-id), not space reader routes
 */
export declare function canAccessUnpublishedPage(user: {
    role: Role;
}, access: PermissionLevel, purpose: "read" | "edit"): boolean;

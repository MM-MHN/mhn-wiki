import { PermissionLevel, Role, type Space } from "@prisma/client";
import { AppError } from "../middleware/error.js";
import { prisma } from "./prisma.js";

const LEVEL_RANK: Record<PermissionLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
};

export function maxLevel(
  a: PermissionLevel,
  b: PermissionLevel
): PermissionLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

export function levelAtLeast(
  level: PermissionLevel,
  required: PermissionLevel
): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}

export async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return memberships.map((m) => m.groupId);
}

/** Highest SpaceMember level for this user (direct or via group). */
export async function getMembershipLevel(
  userId: string,
  spaceId: string,
  groupIds?: string[]
): Promise<PermissionLevel> {
  const groups = groupIds ?? (await getUserGroupIds(userId));
  const members = await prisma.spaceMember.findMany({
    where: {
      spaceId,
      OR: [
        { userId },
        ...(groups.length ? [{ groupId: { in: groups } }] : []),
      ],
    },
    select: { level: true },
  });

  return members.reduce<PermissionLevel>(
    (best, m) => maxLevel(best, m.level),
    PermissionLevel.NONE
  );
}

/**
 * Effective access for a space:
 * - ADMIN always MANAGE
 * - Everyone else: only via SpaceMember (direct user or group membership)
 */
export async function getSpaceAccessLevel(
  user: { id: string; role: Role },
  space: Pick<Space, "id" | "isPrivate">
): Promise<PermissionLevel> {
  if (user.role === Role.ADMIN) return PermissionLevel.MANAGE;
  return getMembershipLevel(user.id, space.id);
}

export async function assertSpaceAccess(
  user: { id: string; role: Role },
  space: Pick<Space, "id" | "isPrivate">,
  required: PermissionLevel = PermissionLevel.VIEW
): Promise<PermissionLevel> {
  const level = await getSpaceAccessLevel(user, space);
  if (!levelAtLeast(level, required)) {
    throw new AppError(403, "You do not have access to this space");
  }
  return level;
}

export async function filterSpacesByAccess<
  T extends Pick<Space, "id" | "isPrivate">,
>(user: { id: string; role: Role }, spaces: T[]): Promise<T[]> {
  if (user.role === Role.ADMIN) return spaces;

  const groupIds = await getUserGroupIds(user.id);
  const results: T[] = [];

  for (const space of spaces) {
    const level = await getMembershipLevel(user.id, space.id, groupIds);
    if (levelAtLeast(level, PermissionLevel.VIEW)) {
      results.push(space);
    }
  }

  return results;
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PrismaClient,
  type EditorType,
  type PermissionLevel,
  type Role,
} from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "seed-data.json");

type SeedSnapshot = {
  exportedAt?: string;
  users: Array<{
    id: string;
    username: string;
    email: string | null;
    name: string;
    passwordHash: string;
    role: Role;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  }>;
  groupMembers: Array<{ id: string; userId: string; groupId: string }>;
  spaces: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    isPrivate: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  spaceMembers: Array<{
    id: string;
    spaceId: string;
    userId: string | null;
    groupId: string | null;
    level: PermissionLevel;
  }>;
  pages: Array<{
    id: string;
    spaceId: string;
    parentId: string | null;
    title: string;
    slug: string;
    content: string;
    editorType: EditorType;
    published: boolean;
    order: number;
    authorId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  pagePermissions: Array<{
    id: string;
    pageId: string;
    userId: string | null;
    groupId: string | null;
    level: PermissionLevel;
  }>;
  settings: Array<{ id: string; key: string; value: string }>;
};

function sortPagesParentsFirst<T extends { id: string; parentId: string | null }>(
  pages: T[]
): T[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const result: T[] = [];
  const seen = new Set<string>();

  function visit(id: string) {
    if (seen.has(id)) return;
    const page = byId.get(id);
    if (!page) return;
    if (page.parentId) visit(page.parentId);
    seen.add(id);
    result.push(page);
  }

  for (const page of pages) visit(page.id);
  return result;
}

async function main() {
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `Missing ${dataPath}. Run: npm run db:export-seed -w server`
    );
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8")) as SeedSnapshot;
  console.log(
    `Seeding from snapshot${data.exportedAt ? ` (${data.exportedAt})` : ""}…`
  );

  await prisma.$transaction(async (tx) => {
    await tx.pagePermission.deleteMany();
    await tx.page.deleteMany();
    await tx.spaceMember.deleteMany();
    await tx.space.deleteMany();
    await tx.groupMember.deleteMany();
    await tx.group.deleteMany();
    await tx.user.deleteMany();
    await tx.setting.deleteMany();

    if (data.users.length) {
      await tx.user.createMany({
        data: data.users.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.name,
          passwordHash: u.passwordHash,
          role: u.role,
          avatarUrl: u.avatarUrl,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        })),
      });
    }

    if (data.groups.length) {
      await tx.group.createMany({
        data: data.groups.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          createdAt: new Date(g.createdAt),
        })),
      });
    }

    if (data.groupMembers.length) {
      await tx.groupMember.createMany({
        data: data.groupMembers.map((m) => ({
          id: m.id,
          userId: m.userId,
          groupId: m.groupId,
        })),
      });
    }

    if (data.spaces.length) {
      await tx.space.createMany({
        data: data.spaces.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          icon: s.icon,
          isPrivate: s.isPrivate,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
      });
    }

    if (data.spaceMembers.length) {
      await tx.spaceMember.createMany({
        data: data.spaceMembers.map((m) => ({
          id: m.id,
          spaceId: m.spaceId,
          userId: m.userId,
          groupId: m.groupId,
          level: m.level,
        })),
      });
    }

    const orderedPages = sortPagesParentsFirst(data.pages || []);
    for (const p of orderedPages) {
      await tx.page.create({
        data: {
          id: p.id,
          spaceId: p.spaceId,
          parentId: p.parentId,
          title: p.title,
          slug: p.slug,
          content: p.content,
          editorType: p.editorType,
          published: p.published,
          order: p.order,
          authorId: p.authorId,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        },
      });
    }

    if (data.pagePermissions.length) {
      await tx.pagePermission.createMany({
        data: data.pagePermissions.map((p) => ({
          id: p.id,
          pageId: p.pageId,
          userId: p.userId,
          groupId: p.groupId,
          level: p.level,
        })),
      });
    }

    if (data.settings.length) {
      await tx.setting.createMany({
        data: data.settings.map((s) => ({
          id: s.id,
          key: s.key,
          value: s.value,
        })),
      });
    }
  });

  console.log("Seed complete (restored your saved snapshot).");
  console.log(
    `users=${data.users.length} groups=${data.groups.length} spaces=${data.spaces.length} pages=${data.pages.length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "seed-data.json");

async function main() {
  const [users, groups, groupMembers, spaces, spaceMembers, pages, pagePermissions, pageRevisions, settings] =
    await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.group.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.groupMember.findMany({ orderBy: { id: "asc" } }),
      prisma.space.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.spaceMember.findMany({ orderBy: { id: "asc" } }),
      prisma.page.findMany({ orderBy: [{ spaceId: "asc" }, { order: "asc" }, { createdAt: "asc" }] }),
      prisma.pagePermission.findMany({ orderBy: { id: "asc" } }),
      prisma.pageRevision.findMany({ orderBy: [{ pageId: "asc" }, { createdAt: "asc" }] }),
      prisma.setting.findMany({ orderBy: { key: "asc" } }),
    ]);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    users,
    groups,
    groupMembers,
    spaces,
    spaceMembers,
    pages,
    pagePermissions,
    pageRevisions,
    settings,
  };

  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Saved snapshot -> ${outPath}`);
  console.log(
    `users=${users.length} groups=${groups.length} spaces=${spaces.length} pages=${pages.length} settings=${settings.length}`
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

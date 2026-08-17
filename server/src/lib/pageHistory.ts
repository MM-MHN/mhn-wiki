import type { EditorType, Page, PageRevisionAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type PageSnapshot = Pick<
  Page,
  | "id"
  | "title"
  | "slug"
  | "content"
  | "editorType"
  | "published"
  | "parentId"
  | "order"
>;

export async function recordPageRevision(
  page: PageSnapshot,
  action: PageRevisionAction,
  editedById: string,
  tx: Prisma.TransactionClient = prisma
) {
  return tx.pageRevision.create({
    data: {
      pageId: page.id,
      action,
      title: page.title,
      slug: page.slug,
      content: page.content,
      editorType: page.editorType as EditorType,
      published: page.published,
      parentId: page.parentId,
      order: page.order,
      editedById,
    },
  });
}

export const revisionListSelect = {
  id: true,
  pageId: true,
  action: true,
  title: true,
  slug: true,
  editorType: true,
  published: true,
  parentId: true,
  order: true,
  createdAt: true,
  editedBy: { select: { id: true, name: true, username: true } },
} as const;

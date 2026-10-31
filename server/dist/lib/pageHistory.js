import { prisma } from "./prisma.js";
export async function recordPageRevision(page, action, editedById, tx = prisma) {
    return tx.pageRevision.create({
        data: {
            pageId: page.id,
            action,
            title: page.title,
            slug: page.slug,
            content: page.content,
            editorType: page.editorType,
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
};

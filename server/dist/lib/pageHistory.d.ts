import type { Page, PageRevisionAction, Prisma } from "@prisma/client";
type PageSnapshot = Pick<Page, "id" | "title" | "slug" | "content" | "editorType" | "published" | "parentId" | "order">;
export declare function recordPageRevision(page: PageSnapshot, action: PageRevisionAction, editedById: string, tx?: Prisma.TransactionClient): Promise<any>;
export declare const revisionListSelect: {
    readonly id: true;
    readonly pageId: true;
    readonly action: true;
    readonly title: true;
    readonly slug: true;
    readonly editorType: true;
    readonly published: true;
    readonly parentId: true;
    readonly order: true;
    readonly createdAt: true;
    readonly editedBy: {
        readonly select: {
            readonly id: true;
            readonly name: true;
            readonly username: true;
        };
    };
};
export {};

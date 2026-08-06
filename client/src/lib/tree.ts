import type { PageNode } from "@/lib/api";

export type TreeNode = PageNode & { children: TreeNode[] };

export function buildPageTree(pages: PageNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  pages.forEach((p) => map.set(p.id, { ...p, children: [] }));

  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

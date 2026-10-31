import {
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api, type PageNode } from "@/lib/api";
import { buildPageTree, type TreeNode } from "@/lib/tree";
import { cn } from "@/lib/utils";

type DropPos = "before" | "after" | "inside";

function collectDescendantIds(node: TreeNode, out = new Set<string>()) {
  out.add(node.id);
  node.children.forEach((c) => collectDescendantIds(c, out));
  return out;
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function siblingsOf(
  pages: PageNode[],
  parentId: string | null,
  excludeId?: string
) {
  return pages
    .filter(
      (p) =>
        (p.parentId ?? null) === parentId && (!excludeId || p.id !== excludeId)
    )
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

async function persistSiblingOrders(
  siblings: PageNode[],
  parentId: string | null,
  originals: PageNode[]
) {
  await Promise.all(
    siblings.map((p, index) => {
      const orig = originals.find((o) => o.id === p.id);
      if (
        orig &&
        orig.order === index &&
        (orig.parentId ?? null) === parentId
      ) {
        return Promise.resolve();
      }
      return api.updatePage(p.id, { parentId, order: index });
    })
  );
}

export async function movePageInSpace(
  pages: PageNode[],
  dragId: string,
  targetId: string,
  position: DropPos
): Promise<void> {
  if (dragId === targetId) return;

  const tree = buildPageTree(pages);
  const dragNode = findNode(tree, dragId);
  const targetNode = findNode(tree, targetId);
  if (!dragNode || !targetNode) return;

  const dragDescendants = collectDescendantIds(dragNode);
  if (dragDescendants.has(targetId)) return;

  const oldParentId = dragNode.parentId ?? null;
  let newParentId: string | null;
  let insertIndex: number;

  if (position === "inside") {
    newParentId = targetId;
    insertIndex = siblingsOf(pages, newParentId, dragId).length;
  } else {
    newParentId = targetNode.parentId ?? null;
    const siblings = siblingsOf(pages, newParentId, dragId);
    const targetIndex = siblings.findIndex((p) => p.id === targetId);
    insertIndex =
      position === "before"
        ? Math.max(0, targetIndex)
        : Math.min(siblings.length, targetIndex + 1);
  }

  const source = pages.find((p) => p.id === dragId);
  if (!source) return;

  const newSiblings = siblingsOf(pages, newParentId, dragId);
  newSiblings.splice(insertIndex, 0, {
    ...source,
    parentId: newParentId,
    order: insertIndex,
  });

  await persistSiblingOrders(newSiblings, newParentId, pages);

  if (oldParentId !== newParentId) {
    await persistSiblingOrders(
      siblingsOf(pages, oldParentId, dragId),
      oldParentId,
      pages
    );
  }
}

function TreeRows({
  nodes,
  depth,
  activeId,
  showLiveBadge,
  collapsed,
  onToggle,
  onSelect,
  dragId,
  dropHint,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  nodes: TreeNode[];
  depth: number;
  activeId: string | null;
  showLiveBadge: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  dragId: string | null;
  dropHint: { id: string; pos: DropPos } | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, pos: DropPos) => void;
  onDrop: (id: string, pos: DropPos) => void;
  onDragEnd: () => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsed.has(node.id);
        const active = activeId === node.id;
        const isDragging = dragId === node.id;
        const hint = dropHint?.id === node.id ? dropHint.pos : null;

        return (
          <div key={node.id}>
            <div
              role="treeitem"
              aria-selected={active}
              aria-expanded={hasChildren ? !isCollapsed : undefined}
              className={cn(
                "relative flex items-center gap-0.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/80",
                isDragging && "opacity-40",
                hint === "inside" && "bg-primary/5 ring-2 ring-primary/40"
              )}
              style={{ paddingLeft: `${depth * 14 + 4}px` }}
              draggable
              onDragStart={(e: DragEvent) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", node.id);
                onDragStart(node.id);
              }}
              onDragEnd={onDragEnd}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientY - rect.top) / rect.height;
                let pos: DropPos = "inside";
                if (ratio < 0.28) pos = "before";
                else if (ratio > 0.72) pos = "after";
                onDragOver(node.id, pos);
              }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const pos = dropHint?.id === node.id ? dropHint.pos : "inside";
                onDrop(node.id, pos);
              }}
            >
              {hint === "before" && (
                <span className="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary" />
              )}
              {hint === "after" && (
                <span className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
              )}

              <span
                className="flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing touch-manipulation"
                title="Drag to reorder"
                aria-hidden
                onMouseDown={(e: MouseEvent) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </span>

              {hasChildren ? (
                <button
                  type="button"
                  className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted touch-manipulation"
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.id);
                  }}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground/60">
                  <FileText className="h-3.5 w-3.5" />
                </span>
              )}

              <button
                type="button"
                onClick={() => onSelect(node.id)}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 text-left touch-manipulation"
              >
                <span className="min-w-0 truncate font-medium">{node.title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {node.published === false && (
                    <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      Hidden
                    </Badge>
                  )}
                  {node.published && showLiveBadge && (
                    <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      Live
                    </Badge>
                  )}
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    {node.editorType}
                  </span>
                </span>
              </button>
            </div>

            {hasChildren && !isCollapsed && (
              <TreeRows
                nodes={node.children}
                depth={depth + 1}
                activeId={activeId}
                showLiveBadge={showLiveBadge}
                collapsed={collapsed}
                onToggle={onToggle}
                onSelect={onSelect}
                dragId={dragId}
                dropHint={dropHint}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export function AdminPageTree({
  pages,
  activeId,
  showLiveBadge,
  onSelect,
  onChanged,
  onError,
}: {
  pages: PageNode[];
  activeId: string | null;
  showLiveBadge?: boolean;
  onSelect: (pageId: string) => void;
  onChanged: () => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const tree = useMemo(() => buildPageTree(pages), [pages]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: DropPos } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  if (!pages.length) {
    return (
      <p className="px-1 py-2 text-sm text-muted-foreground">No pages yet.</p>
    );
  }

  const handleDrop = async (targetId: string, pos: DropPos) => {
    if (!dragId || busy) return;
    setBusy(true);
    setDropHint(null);
    try {
      await movePageInSpace(pages, dragId, targetId, pos);
      await onChanged();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not move page");
    } finally {
      setBusy(false);
      setDragId(null);
    }
  };

  return (
    <div
      className={cn("space-y-0.5", busy && "pointer-events-none opacity-70")}
      role="tree"
      aria-label="Page hierarchy"
    >
      <TreeRows
        nodes={tree}
        depth={0}
        activeId={activeId}
        showLiveBadge={Boolean(showLiveBadge)}
        collapsed={collapsed}
        onToggle={(id) =>
          setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onSelect={onSelect}
        dragId={dragId}
        dropHint={dropHint}
        onDragStart={setDragId}
        onDragOver={(id, pos) => setDropHint({ id, pos })}
        onDrop={handleDrop}
        onDragEnd={() => {
          setDragId(null);
          setDropHint(null);
        }}
      />
    </div>
  );
}

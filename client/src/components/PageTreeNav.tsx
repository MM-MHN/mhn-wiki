import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { TreeNode } from "@/lib/tree";
import { cn } from "@/lib/utils";

function Node({
  node,
  spaceSlug,
  activeSlug,
  depth = 0,
}: {
  node: TreeNode;
  spaceSlug: string;
  activeSlug?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const active = activeSlug === node.slug;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-md pr-1 text-sm transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-sidebar-foreground hover:bg-muted/80"
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted touch-manipulation"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="flex h-11 w-9 shrink-0 items-center justify-center opacity-50">
            <FileText className="h-3.5 w-3.5" />
          </span>
        )}
        <Link
          to={`/s/${spaceSlug}/${node.slug}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 truncate py-2 pr-2 font-medium touch-manipulation"
        >
          <span className="truncate">{node.title}</span>
          {node.published === false && (
            <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              Hidden
            </span>
          )}
        </Link>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <Node
              key={child.id}
              node={child}
              spaceSlug={spaceSlug}
              activeSlug={activeSlug}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageTreeNav({
  tree,
  spaceSlug,
  activeSlug,
}: {
  tree: TreeNode[];
  spaceSlug: string;
  activeSlug?: string;
}) {
  if (!tree.length) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        No pages yet. Add content from Admin.
      </p>
    );
  }

  return (
    <nav className="space-y-0.5 p-2" aria-label="Pages in space">
      {tree.map((node) => (
        <Node
          key={node.id}
          node={node}
          spaceSlug={spaceSlug}
          activeSlug={activeSlug}
        />
      ))}
    </nav>
  );
}

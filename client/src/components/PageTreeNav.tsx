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
          "group flex items-center gap-1 rounded-md pr-2 text-sm",
          active
            ? "bg-primary/10 text-primary"
            : "text-sidebar-foreground hover:bg-muted"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="rounded p-1 hover:bg-muted"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="p-1">
            <FileText className="h-3.5 w-3.5 opacity-50" />
          </span>
        )}
        <Link
          to={`/s/${spaceSlug}/${node.slug}`}
          className="flex-1 truncate py-1.5 font-medium"
        >
          {node.title}
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
    <nav className="space-y-0.5 p-2">
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

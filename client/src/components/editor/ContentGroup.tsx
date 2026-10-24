import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Trash2,
  Ungroup,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { countSelectedBlocks } from "@/components/editor/groupSelection";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    contentGroup: {
      /** Wrap ≥2 selected sibling blocks in a group container. */
      groupBlocks: (attrs?: { title?: string }) => ReturnType;
      /** Dissolve the nearest group wrapper; children stay in place. */
      ungroupBlocks: () => ReturnType;
      /** @deprecated Prefer groupBlocks / ungroupBlocks */
      setContentGroup: (attrs?: { title?: string }) => ReturnType;
      toggleContentGroup: () => ReturnType;
      unsetContentGroup: () => ReturnType;
    };
  }
}

function ContentGroupView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const collapsed = Boolean(node.attrs.collapsed);
  const title = (node.attrs.title as string) || "Group";

  const ungroup = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos === "number") {
      editor.chain().focus().setNodeSelection(pos).ungroupBlocks().run();
      return;
    }
    editor.chain().focus().ungroupBlocks().run();
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "content-group group-container my-4 overflow-hidden rounded-lg border-2 border-dashed border-primary/30 bg-muted/20",
        selected && "border-solid border-primary ring-2 ring-primary/30"
      )}
      data-type="content-group"
      data-group-container="true"
      data-collapsed={collapsed ? "true" : "false"}
      data-id={node.attrs.id || undefined}
    >
      <div
        className="flex items-center gap-1 border-b border-border bg-muted/50 px-2 py-1.5"
        contentEditable={false}
        data-drag-handle
      >
        <span
          className="cursor-grab px-1 text-muted-foreground active:cursor-grabbing"
          title="Drag to move entire group"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={collapsed ? "Expand group" : "Collapse group"}
          aria-expanded={!collapsed}
          onClick={() => updateAttributes({ collapsed: !collapsed })}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <input
          type="text"
          value={title}
          aria-label="Group title"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none focus:border-input focus:bg-card"
          onChange={(e) => updateAttributes({ title: e.target.value })}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 px-2 text-xs"
          title="Ungroup (Ctrl/Cmd+Shift+G)"
          onClick={ungroup}
        >
          <Ungroup className="h-3.5 w-3.5" />
          Ungroup
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive"
          title="Delete group and all contents"
          onClick={() => deleteNode()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {!collapsed && (
        <NodeViewContent className="content-group-body px-3 py-2" />
      )}
    </NodeViewWrapper>
  );
}

/**
 * Group container (stored as `contentGroup` for backward-compatible HTML).
 * Wraps sibling blocks so they move / collapse / copy as one unit.
 */
export const ContentGroup = Node.create({
  name: "contentGroup",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) =>
          attributes.id ? { "data-id": attributes.id } : {},
      },
      title: {
        default: "Group",
        parseHTML: (element) =>
          element.getAttribute("data-title") ||
          element.querySelector("summary")?.textContent ||
          "Group",
        renderHTML: (attributes) => ({
          "data-title": attributes.title || "Group",
        }),
      },
      collapsed: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute("data-collapsed") === "true" ||
          (element.tagName === "DETAILS" && !element.hasAttribute("open")),
        renderHTML: (attributes) => ({
          "data-collapsed": attributes.collapsed ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="content-group"]' },
      { tag: 'div[data-group-container="true"]' },
      { tag: "details.content-group" },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const collapsed = Boolean(node.attrs.collapsed);
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        class: "content-group group-container",
        "data-type": "content-group",
        "data-group-container": "true",
        "data-title": node.attrs.title || "Group",
        "data-collapsed": collapsed ? "true" : "false",
        ...(collapsed ? {} : { open: "" }),
      }),
      ["summary", {}, node.attrs.title || "Group"],
      ["div", { class: "content-group-body" }, 0],
    ];
  },

  addCommands() {
    return {
      groupBlocks:
        (attrs) =>
        ({ state, commands }) => {
          if (countSelectedBlocks(state) < 2) return false;
          return commands.wrapIn(this.name, {
            title: attrs?.title || "Group",
            collapsed: false,
          });
        },
      ungroupBlocks:
        () =>
        ({ state, commands }) => {
          const { $from } = state.selection;
          let found = false;
          for (let d = $from.depth; d > 0; d -= 1) {
            if ($from.node(d).type.name === this.name) {
              found = true;
              break;
            }
          }
          if (!found && state.selection.$from.parent.type.name !== this.name) {
            // NodeSelection of the group itself
            const node = state.selection.$from.nodeAfter;
            if (node?.type.name !== this.name) return false;
          }
          return commands.lift(this.name);
        },
      setContentGroup:
        (attrs) =>
        ({ commands }) =>
          commands.groupBlocks(attrs),
      toggleContentGroup:
        () =>
        ({ commands, state }) => {
          const { $from } = state.selection;
          for (let d = $from.depth; d > 0; d -= 1) {
            if ($from.node(d).type.name === this.name) {
              return commands.ungroupBlocks();
            }
          }
          return commands.groupBlocks();
        },
      unsetContentGroup:
        () =>
        ({ commands }) =>
          commands.ungroupBlocks(),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-g": () => this.editor.commands.groupBlocks(),
      "Mod-Shift-g": () => this.editor.commands.ungroupBlocks(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ContentGroupView);
  },
});

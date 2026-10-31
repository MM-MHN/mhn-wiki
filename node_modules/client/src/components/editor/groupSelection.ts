import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import {
  getSelectionRanges,
  isNodeRangeSelection,
} from "@tiptap/extension-node-range";

const GROUP_NAME = "contentGroup";

/** Count top-level block nodes covered by the current selection. */
export function countSelectedBlocks(state: EditorState): number {
  const { selection } = state;
  const depth = isNodeRangeSelection(selection) ? selection.depth : undefined;
  const ranges = getSelectionRanges(selection.$from, selection.$to, depth, {
    extendOnBoundaryOverlap: true,
  });
  return ranges.filter((r) => r.$from.nodeAfter).length;
}

export function isInsideGroup(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === GROUP_NAME) return true;
  }
  return false;
}

/** True when the selection is (or is inside) a group that can be dissolved. */
export function canUngroup(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (editor.isActive(GROUP_NAME)) return editor.can().lift(GROUP_NAME);
  return isInsideGroup(editor.state) && editor.can().lift(GROUP_NAME);
}

/**
 * True when ≥2 sibling blocks are selected and wrapping into a group is legal.
 * Rejects single-item “groups” and selections already fully inside one group
 * that would nest invalidly when wrapIn fails.
 */
export function canGroup(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (countSelectedBlocks(editor.state) < 2) return false;
  return editor.can().wrapIn(GROUP_NAME, {
    title: "Group",
    collapsed: false,
  });
}

export { GROUP_NAME };

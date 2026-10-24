import type { Editor, JSONContent } from "@tiptap/core";

export const WIKI_BLOCKS_MIME = "application/x-wiki-editor-blocks";

/** Strip node IDs so UniqueID assigns fresh ones on insert/paste. */
export function stripNodeIds(content: JSONContent | JSONContent[]): JSONContent[] {
  const nodes = Array.isArray(content) ? content : [content];
  return nodes.map((node) => {
    const next: JSONContent = { ...node };
    if (next.attrs && "id" in next.attrs) {
      const { id: _id, ...rest } = next.attrs as Record<string, unknown>;
      next.attrs = rest;
    }
    if (next.content?.length) {
      next.content = stripNodeIds(next.content);
    }
    return next;
  });
}

export function getSelectedJson(editor: Editor): JSONContent[] | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const json = editor.state.doc.slice(from, to).content.toJSON();
  if (!json) return null;
  return Array.isArray(json) ? json : [json as JSONContent];
}

/** Duplicate current selection (or current block) after the selection. */
export function duplicateSelection(editor: Editor): boolean {
  const { state } = editor;
  const { to, empty, $from } = state.selection;

  let nodes: JSONContent[] | null = null;
  let insertPos = to;

  if (!empty) {
    nodes = getSelectedJson(editor);
  } else {
    // Duplicate the top-level block containing the cursor
    let depth = $from.depth;
    while (depth > 0 && $from.node(depth).type.name === "doc") depth -= 1;
    // Prefer depth-1 block under doc
    const blockDepth = Math.min($from.depth, 1);
    const block = $from.node(blockDepth === 0 ? 1 : blockDepth);
    const pos = $from.before(blockDepth === 0 ? 1 : blockDepth);
    if (!block || block.type.name === "doc") return false;
    nodes = [block.toJSON() as JSONContent];
    insertPos = pos + block.nodeSize;
  }

  if (!nodes?.length) return false;

  const fresh = stripNodeIds(nodes);
  return editor
    .chain()
    .focus()
    .insertContentAt(insertPos, fresh)
    .run();
}

function resolveCopyPayload(editor: Editor): {
  nodes: JSONContent[];
  plain: string;
} | null {
  let nodes = getSelectedJson(editor);
  let plain = "";

  if (!nodes?.length) {
    const { $from } = editor.state.selection;
    const depth = Math.min($from.depth, 1) || 1;
    const block = $from.node(depth);
    if (!block || block.type.name === "doc") return null;
    nodes = [block.toJSON() as JSONContent];
    plain = block.textContent || "";
  } else {
    plain = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      "\n"
    );
  }

  return { nodes: stripNodeIds(nodes), plain };
}

/** Sync write into a ClipboardEvent (Ctrl/Cmd+C / cut). */
export function writeSelectionToClipboardEvent(
  editor: Editor,
  event: ClipboardEvent
): boolean {
  const payload = resolveCopyPayload(editor);
  if (!payload) return false;
  const raw = JSON.stringify(payload.nodes);
  event.clipboardData?.setData(WIKI_BLOCKS_MIME, raw);
  event.clipboardData?.setData("text/plain", payload.plain || " ");
  sessionStorage.setItem(WIKI_BLOCKS_MIME, raw);
  return true;
}

export async function copySelectionToClipboard(editor: Editor): Promise<boolean> {
  const payload = resolveCopyPayload(editor);
  if (!payload) return false;
  return writeBlocks(payload.nodes, payload.plain);
}

async function writeBlocks(
  nodes: JSONContent[],
  plainFallback: string
): Promise<boolean> {
  const payload = JSON.stringify(stripNodeIds(nodes));
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/plain": new Blob([plainFallback || " "], { type: "text/plain" }),
        [WIKI_BLOCKS_MIME]: new Blob([payload], { type: WIKI_BLOCKS_MIME }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    await navigator.clipboard.writeText(payload);
    // Store MIME payload in session for paste within app when custom MIME unsupported
    sessionStorage.setItem(WIKI_BLOCKS_MIME, payload);
    return true;
  } catch {
    sessionStorage.setItem(WIKI_BLOCKS_MIME, payload);
    return true;
  }
}

export async function pasteBlocksFromClipboard(
  editor: Editor
): Promise<boolean> {
  let raw: string | null = null;

  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes(WIKI_BLOCKS_MIME)) {
          raw = await (await item.getType(WIKI_BLOCKS_MIME)).text();
          break;
        }
      }
    }
  } catch {
    // permission / unsupported
  }

  if (!raw) {
    raw = sessionStorage.getItem(WIKI_BLOCKS_MIME);
  }

  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as JSONContent | JSONContent[];
    const nodes = stripNodeIds(parsed);
    if (!nodes.length) return false;
    return editor.chain().focus().insertContent(nodes).run();
  } catch {
    return false;
  }
}

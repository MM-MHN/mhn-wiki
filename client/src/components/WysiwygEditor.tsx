import { useRef, useState, type ReactNode } from "react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import NodeRange from "@tiptap/extension-node-range";
import UniqueID from "@tiptap/extension-unique-id";
import {
  EditorContent,
  useEditor,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ClipboardPaste,
  Code,
  Code2,
  Copy,
  CopyPlus,
  Group,
  GripVertical,
  Ungroup,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Upload,
} from "lucide-react";
import {
  copySelectionToClipboard,
  duplicateSelection,
  pasteBlocksFromClipboard,
  stripNodeIds,
  writeSelectionToClipboardEvent,
  WIKI_BLOCKS_MIME,
} from "@/components/editor/clipboard";
import { ContentGroup } from "@/components/editor/ContentGroup";
import {
  canGroup,
  canUngroup,
} from "@/components/editor/groupSelection";
import { MultiSelectOutline } from "@/components/editor/MultiSelectOutline";
import { ResizableImage } from "@/components/editor/ResizableImage";
import {
  CustomTableCell,
  CustomTableHeader,
} from "@/components/editor/tableCells";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { JSONContent } from "@tiptap/core";

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      disabled={disabled}
      className={cn("h-8 w-8", active && "bg-muted text-primary")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

function isHttpUrl(text: string) {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function uploadImageFile(file: File): Promise<string> {
  const { url } = await api.uploadImage(file);
  return url;
}

function EditorToolbar({
  editor,
  uploading,
  onUploadStart,
  onUploadEnd,
  onError,
}: {
  editor: Editor;
  uploading: boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Paste or type link URL", previous || "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim(), target: "_blank" })
      .run();
  };

  const addImageFromUrl = () => {
    const url = window.prompt("Paste image URL", "https://");
    if (!url?.trim()) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const removeImage = () => {
    if (!editor.isActive("image")) return;
    editor.chain().focus().deleteSelection().run();
  };

  const uploadFromDevice = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Please choose an image file.");
      return;
    }
    onUploadStart();
    try {
      const url = await uploadImageFile(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      onUploadEnd();
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-2">
      <ToolbarButton
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Paragraph"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Highlight"
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <label
        className="flex h-8 items-center gap-1 px-1 text-xs text-muted-foreground"
        title="Text color"
      >
        <span className="sr-only">Text color</span>
        <input
          type="color"
          className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
          value={editor.getAttributes("textStyle").color || "#001890"}
          onChange={(e) =>
            editor.chain().focus().setColor(e.target.value).run()
          }
        />
      </label>

      <ToolbarDivider />

      <ToolbarButton
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Justify"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Task list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Blockquote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Group selected blocks (Ctrl/Cmd+G) — select 2+ with Shift+drag or Shift+↑/↓"
        active={editor.isActive("contentGroup")}
        disabled={!canGroup(editor)}
        onClick={() => editor.chain().focus().groupBlocks().run()}
      >
        <Group className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Ungroup (Ctrl/Cmd+Shift+G)"
        disabled={!canUngroup(editor)}
        onClick={() => editor.chain().focus().ungroupBlocks().run()}
      >
        <Ungroup className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Insert / paste link URL"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Insert image from URL" onClick={addImageFromUrl}>
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Upload image from device"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </ToolbarButton>
      {editor.isActive("image") && (
        <ToolbarButton
          title="Remove selected image"
          onClick={removeImage}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </ToolbarButton>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void uploadFromDevice(e.target.files?.[0])}
      />
      <ToolbarDivider />

      <ToolbarButton
        title="Copy selection (Ctrl/Cmd+C)"
        onClick={() => void copySelectionToClipboard(editor)}
      >
        <Copy className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Paste components (Ctrl/Cmd+V)"
        onClick={() => void pasteBlocksFromClipboard(editor)}
      >
        <ClipboardPaste className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Duplicate selection / current block"
        onClick={() => duplicateSelection(editor)}
      >
        <CopyPlus className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Insert table"
        active={editor.isActive("table")}
        onClick={addTable}
      >
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>
      {editor.isActive("table") && (
        <>
          <ToolbarButton
            title="Insert column left"
            disabled={!editor.can().addColumnBefore()}
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          >
            <span className="text-[9px] font-semibold">Col←</span>
          </ToolbarButton>
          <ToolbarButton
            title="Insert column right"
            disabled={!editor.can().addColumnAfter()}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <span className="text-[9px] font-semibold">Col→</span>
          </ToolbarButton>
          <ToolbarButton
            title="Delete column"
            disabled={!editor.can().deleteColumn()}
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <span className="text-[9px] font-semibold text-destructive">
              −Col
            </span>
          </ToolbarButton>
          <ToolbarButton
            title="Insert row above"
            disabled={!editor.can().addRowBefore()}
            onClick={() => editor.chain().focus().addRowBefore().run()}
          >
            <span className="text-[9px] font-semibold">Row↑</span>
          </ToolbarButton>
          <ToolbarButton
            title="Insert row below"
            disabled={!editor.can().addRowAfter()}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <span className="text-[9px] font-semibold">Row↓</span>
          </ToolbarButton>
          <ToolbarButton
            title="Delete row"
            disabled={!editor.can().deleteRow()}
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <span className="text-[9px] font-semibold text-destructive">
              −Row
            </span>
          </ToolbarButton>
          <ToolbarButton
            title="Merge selected cells"
            disabled={!editor.can().mergeCells()}
            onClick={() => editor.chain().focus().mergeCells().run()}
          >
            <span className="text-[9px] font-semibold">Merge</span>
          </ToolbarButton>
          <ToolbarButton
            title="Split / unmerge cell"
            disabled={!editor.can().splitCell()}
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            <span className="text-[9px] font-semibold">Split</span>
          </ToolbarButton>
          <ToolbarButton
            title="Toggle header row"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          >
            <span className="text-[9px] font-semibold">Hdr</span>
          </ToolbarButton>
          <ToolbarButton
            title="Cell align left"
            onClick={() =>
              editor.chain().focus().setCellAttribute("textAlign", "left").run()
            }
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Cell align center"
            onClick={() =>
              editor
                .chain()
                .focus()
                .setCellAttribute("textAlign", "center")
                .run()
            }
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Cell align right"
            onClick={() =>
              editor
                .chain()
                .focus()
                .setCellAttribute("textAlign", "right")
                .run()
            }
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarButton>
          <label
            className="flex h-8 items-center gap-1 px-1 text-xs text-muted-foreground"
            title="Cell background color"
          >
            <span className="sr-only">Cell background</span>
            <input
              type="color"
              className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
              defaultValue="#e8ecf8"
              onChange={(e) =>
                editor
                  .chain()
                  .focus()
                  .setCellAttribute("backgroundColor", e.target.value)
                  .run()
              }
            />
          </label>
          <ToolbarButton
            title="Clear cell background"
            onClick={() =>
              editor
                .chain()
                .focus()
                .setCellAttribute("backgroundColor", null)
                .run()
            }
          >
            <span className="text-[9px] font-semibold">Bg×</span>
          </ToolbarButton>
          <ToolbarButton
            title="Delete entire table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <span className="text-[9px] font-semibold text-destructive">
              Del tbl
            </span>
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

type ContextMenuState = {
  x: number;
  y: number;
  inTable: boolean;
} | null;

function EditorContextMenu({
  editor,
  menu,
  onClose,
}: {
  editor: Editor;
  menu: ContextMenuState;
  onClose: () => void;
}) {
  if (!menu) return null;

  const item = (
    label: string,
    action: () => void,
    disabled?: boolean
  ) => (
    <button
      type="button"
      disabled={disabled}
      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      onClick={() => {
        action();
        onClose();
      }}
    >
      {label}
    </button>
  );

  const groupOk = canGroup(editor);
  const ungroupOk = canUngroup(editor);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close menu"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        className="fixed z-50 min-w-[200px] rounded-md border border-border bg-card p-1 shadow-lg"
        style={{ left: menu.x, top: menu.y }}
      >
        {item("Copy", () => void copySelectionToClipboard(editor))}
        {item("Paste", () => void pasteBlocksFromClipboard(editor))}
        {item("Duplicate", () => {
          duplicateSelection(editor);
        })}
        <div className="my-1 border-t border-border" />
        {item(
          "Group",
          () => editor.chain().focus().groupBlocks().run(),
          !groupOk
        )}
        {item(
          "Ungroup",
          () => editor.chain().focus().ungroupBlocks().run(),
          !ungroupOk
        )}
        {menu.inTable && (
          <>
            <div className="my-1 border-t border-border" />
            {item("Insert row above", () =>
              editor.chain().focus().addRowBefore().run()
            )}
            {item("Insert row below", () =>
              editor.chain().focus().addRowAfter().run()
            )}
            {item("Insert column left", () =>
              editor.chain().focus().addColumnBefore().run()
            )}
            {item("Insert column right", () =>
              editor.chain().focus().addColumnAfter().run()
            )}
            {item(
              "Delete row",
              () => editor.chain().focus().deleteRow().run(),
              !editor.can().deleteRow()
            )}
            {item(
              "Delete column",
              () => editor.chain().focus().deleteColumn().run(),
              !editor.can().deleteColumn()
            )}
            {item(
              "Merge cells",
              () => editor.chain().focus().mergeCells().run(),
              !editor.can().mergeCells()
            )}
            {item(
              "Split / unmerge cell",
              () => editor.chain().focus().splitCell().run(),
              !editor.can().splitCell()
            )}
            {item("Toggle header row", () =>
              editor.chain().focus().toggleHeaderRow().run()
            )}
            {item("Delete table", () =>
              editor.chain().focus().deleteTable().run()
            )}
          </>
        )}
      </div>
    </>
  );
}

export function WysiwygEditor({
  value,
  onChange,
  placeholder = "Start writing…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const editorRef = useRef<Editor | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const insertUploadedImage = async (ed: Editor, file: File) => {
    setUploading(true);
    setError("");
    try {
      const url = await uploadImageFile(file);
      ed.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: {
          color: "var(--color-primary)",
          width: 3,
          class: "wiki-dropcursor",
        },
      }),
      NodeRange.configure({
        // Shift+click-drag or Shift+Arrow selects multiple sibling blocks
        key: "Shift",
      }),
      UniqueID.configure({
        attributeName: "id",
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "codeBlock",
          "bulletList",
          "orderedList",
          "taskList",
          "listItem",
          "taskItem",
          "horizontalRule",
          "image",
          "contentGroup",
          "table",
        ],
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      ResizableImage.configure({
        allowBase64: true,
        HTMLAttributes: { class: "rounded-md max-w-full h-auto" },
      }),
      Placeholder.configure({ placeholder }),
      ContentGroup,
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
    ],
    content: value || "",
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
    },
    onDestroy: () => {
      editorRef.current = null;
    },
    editorProps: {
      attributes: {
        class:
          "prose-wiki wysiwyg-content min-h-[240px] px-3 py-3 text-foreground outline-none dark:text-slate-100 sm:min-h-[320px] sm:px-4",
      },
      handleDOMEvents: {
        copy: (_view, event) => {
          const ed = editorRef.current;
          if (!ed) return false;
          if (writeSelectionToClipboardEvent(ed, event)) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        cut: (_view, event) => {
          const ed = editorRef.current;
          if (!ed || ed.state.selection.empty) return false;
          if (writeSelectionToClipboardEvent(ed, event)) {
            event.preventDefault();
            ed.commands.deleteSelection();
            return true;
          }
          return false;
        },
      },
      handleKeyDown: (_view, event) => {
        const ed = editorRef.current;
        if (!ed) return false;
        const mod = event.metaKey || event.ctrlKey;
        if (mod && event.key.toLowerCase() === "d") {
          event.preventDefault();
          duplicateSelection(ed);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const ed = editorRef.current;
        if (!ed) return false;

        // Custom block clipboard from Copy / Duplicate flow
        const wikiRaw = clipboard.getData(WIKI_BLOCKS_MIME);
        if (wikiRaw) {
          try {
            const parsed = JSON.parse(wikiRaw) as JSONContent | JSONContent[];
            const nodes = stripNodeIds(parsed);
            if (nodes.length) {
              event.preventDefault();
              ed.chain().focus().insertContent(nodes).run();
              return true;
            }
          } catch {
            // continue
          }
        }

        const files = Array.from(clipboard.files || []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (files.length) {
          event.preventDefault();
          void (async () => {
            for (const file of files) {
              await insertUploadedImage(ed, file);
            }
          })();
          return true;
        }

        const text = clipboard.getData("text/plain")?.trim();
        if (text && isHttpUrl(text) && !clipboard.getData("text/html")) {
          event.preventDefault();
          const { empty } = ed.state.selection;
          if (!empty) {
            ed.chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: text, target: "_blank" })
              .run();
          } else {
            ed.chain()
              .focus()
              .insertContent({
                type: "text",
                text,
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: text,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    },
                  },
                ],
              })
              .run();
          }
          return true;
        }

        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((f) =>
          f.type.startsWith("image/")
        );
        if (!files.length) return false;
        const ed = editorRef.current;
        if (!ed) return false;
        event.preventDefault();
        void (async () => {
          for (const file of files) {
            await insertUploadedImage(ed, file);
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  if (!editor) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-md border border-input bg-card text-sm text-muted-foreground sm:min-h-[360px]">
        Loading editor…
      </div>
    );
  }

  const chars = editor.storage.characterCount?.characters?.() ?? 0;
  const words = editor.storage.characterCount?.words?.() ?? 0;

  return (
    <div className="flex max-h-[min(70vh,720px)] flex-col overflow-hidden rounded-md border border-input bg-card text-foreground dark:text-slate-100">
      {/* Sticky design / formatting frame — stays visible while canvas scrolls */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-muted/80 shadow-sm backdrop-blur-sm">
        <div className="overflow-x-auto">
          <EditorToolbar
            editor={editor}
            uploading={uploading}
            onUploadStart={() => {
              setUploading(true);
              setError("");
            }}
            onUploadEnd={() => setUploading(false)}
            onError={setError}
          />
        </div>
      </div>
      <div
        ref={canvasRef}
        className="relative min-h-0 flex-1 overflow-y-auto pl-2"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            inTable: editor.isActive("table"),
          });
        }}
      >
        <EditorContent editor={editor} />
        <MultiSelectOutline editor={editor} containerRef={canvasRef} />
        <DragHandle
          editor={editor}
          className="wiki-block-drag-handle absolute z-10 flex h-7 w-6 cursor-grab items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Drag to reorder block</span>
        </DragHandle>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <span className="hidden sm:inline">
          Multi-select: Shift+drag or Shift+↑/↓. Group: Ctrl/Cmd+G · Ungroup:
          Ctrl/Cmd+Shift+G. Undo/redo supported.
        </span>
        <span className="sm:hidden">
          Shift+select · Ctrl/Cmd+G group · Shift+G ungroup
        </span>
        <span className="flex gap-3">
          {uploading && <span className="text-primary">Uploading…</span>}
          {error && <span className="text-destructive">{error}</span>}
          <span>{words} words</span>
          <span>{chars} characters</span>
        </span>
      </div>
      <EditorContextMenu
        editor={editor}
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
}

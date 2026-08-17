import { useRef, useState, type ReactNode } from "react";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
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
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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

function ImageNodeView({ node, selected, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="div"
      className="editor-image-node relative my-4 inline-block max-w-full"
      data-drag-handle
    >
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || ""}
        className={cn(
          "block max-h-[480px] max-w-full rounded-md object-contain",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-card"
        )}
        draggable={false}
      />
      {selected && (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="absolute top-2 right-2 shadow-md"
          title="Remove image"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </Button>
      )}
    </NodeViewWrapper>
  );
}

const SelectableImage = Image.extend({
  selectable: true,
  draggable: true,
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

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
            title="Add column"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <span className="text-[10px] font-semibold">+Col</span>
          </ToolbarButton>
          <ToolbarButton
            title="Add row"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <span className="text-[10px] font-semibold">+Row</span>
          </ToolbarButton>
          <ToolbarButton
            title="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <span className="text-[10px] font-semibold">Del</span>
          </ToolbarButton>
        </>
      )}
    </div>
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
  const editorRef = useRef<Editor | null>(null);

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
      SelectableImage.configure({
        allowBase64: true,
        HTMLAttributes: { class: "rounded-md max-w-full h-auto" },
      }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
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
        class: "prose-wiki wysiwyg-content min-h-[240px] px-3 py-3 outline-none sm:min-h-[320px] sm:px-4",
      },
      handlePaste: (_view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const ed = editorRef.current;
        if (!ed) return false;

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
    <div className="overflow-hidden rounded-md border border-input bg-card">
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
      <EditorContent editor={editor} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="hidden sm:inline">
          Click an image to select it, then Remove / Delete / Backspace. Paste,
          upload, or drag & drop also supported.
        </span>
        <span className="sm:hidden">Paste, upload, or drag images.</span>
        <span className="flex gap-3">
          {uploading && <span className="text-primary">Uploading…</span>}
          {error && <span className="text-destructive">{error}</span>}
          <span>{words} words</span>
          <span>{chars} characters</span>
        </span>
      </div>
    </div>
  );
}

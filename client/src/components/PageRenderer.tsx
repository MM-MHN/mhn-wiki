import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EditorType } from "@/lib/api";

function looksLikeHtml(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content.trim());
}

export function PageRenderer({
  content,
  editorType,
}: {
  content: string;
  editorType: EditorType;
}) {
  if (editorType === "HTML" || editorType === "WYSIWYG") {
    const html =
      editorType === "WYSIWYG" && !looksLikeHtml(content)
        ? // Legacy markdown stored under WYSIWYG before rich editor
          null
        : content;

    if (html !== null) {
      return (
        <div
          className="prose-wiki wysiwyg-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
  }

  return (
    <div className="prose-wiki">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

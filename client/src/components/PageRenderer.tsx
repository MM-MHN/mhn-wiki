import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "@/context/theme";
import type { EditorType } from "@/lib/api";
import { adaptHtmlColorsForTheme } from "@/lib/htmlTheme";
import { cn } from "@/lib/utils";

function looksLikeHtml(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content.trim());
}

export function PageRenderer({
  content,
  editorType,
  className,
}: {
  content: string;
  editorType: EditorType;
  className?: string;
}) {
  const { theme } = useTheme();

  const htmlContent = useMemo(() => {
    if (editorType !== "HTML" && editorType !== "WYSIWYG") return null;
    if (editorType === "WYSIWYG" && !looksLikeHtml(content)) return null;
    return adaptHtmlColorsForTheme(content, theme);
  }, [content, editorType, theme]);

  if (htmlContent !== null) {
    return (
      <div
        className={cn(
          "prose-wiki wysiwyg-content text-foreground dark:text-slate-100",
          className
        )}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  }

  return (
    <div
      className={cn(
        "prose-wiki text-foreground dark:text-slate-100",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

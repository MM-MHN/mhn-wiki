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
          "prose-wiki wysiwyg-content min-w-0 max-w-full text-foreground dark:text-slate-100",
          className
        )}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  }

  return (
    <div
      className={cn(
        "prose-wiki min-w-0 max-w-full text-foreground dark:text-slate-100",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt, title }) => (
            <img
              src={src}
              alt={alt || ""}
              title={title}
              loading="lazy"
              decoding="async"
              className="editor-inline-image h-auto max-w-full rounded-md object-contain"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

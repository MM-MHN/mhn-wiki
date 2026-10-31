import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";

type Box = { top: number; left: number; width: number; height: number };

/**
 * Draws a unified bounding outline around multi-selected blocks
 * (`.ProseMirror-selectednoderange` from the NodeRange extension).
 */
export function MultiSelectOutline({
  editor,
  containerRef,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (!container) {
        setBox(null);
        return;
      }
      const nodes = editor.view.dom.querySelectorAll(
        ".ProseMirror-selectednoderange"
      );
      if (nodes.length < 2) {
        setBox(null);
        return;
      }

      const crect = container.getBoundingClientRect();
      let top = Infinity;
      let left = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;

      nodes.forEach((el) => {
        const r = el.getBoundingClientRect();
        top = Math.min(top, r.top);
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      });

      setBox({
        top: top - crect.top + container.scrollTop,
        left: left - crect.left + container.scrollLeft,
        width: right - left,
        height: bottom - top,
      });
    };

    measure();
    editor.on("selectionUpdate", measure);
    editor.on("transaction", measure);
    const container = containerRef.current;
    container?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      editor.off("selectionUpdate", measure);
      editor.off("transaction", measure);
      container?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [editor, containerRef]);

  if (!box) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[5] rounded-md border-2 border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(0,24,144,0.12)]"
      style={{
        top: box.top - 4,
        left: box.left - 4,
        width: box.width + 8,
        height: box.height + 8,
      }}
    />
  );
}

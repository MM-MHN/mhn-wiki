import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Lock, Unlock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Handle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const HANDLES: Handle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const MIN_SIZE = 48;
const MAX_WIDTH = 1200;

function handleClass(handle: Handle): string {
  const base =
    "absolute z-10 box-border border-2 border-primary bg-card shadow-sm";
  const size = "h-3 w-3";
  switch (handle) {
    case "n":
      return cn(base, size, "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-n-resize");
    case "s":
      return cn(base, size, "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize");
    case "e":
      return cn(base, size, "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-e-resize");
    case "w":
      return cn(base, size, "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-w-resize");
    case "ne":
      return cn(base, size, "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize");
    case "nw":
      return cn(base, size, "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize");
    case "se":
      return cn(base, size, "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize");
    case "sw":
      return cn(base, size, "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize");
  }
}

function ImageNodeView({
  node,
  selected,
  deleteNode,
  updateAttributes,
}: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [lockRatio, setLockRatio] = useState(true);
  const [preview, setPreview] = useState<{ w: number; h: number } | null>(null);

  const width = (node.attrs.width as number | null) ?? null;
  const height = (node.attrs.height as number | null) ?? null;

  const displayW = preview?.w ?? width ?? undefined;
  const displayH = preview?.h ?? height ?? undefined;

  const startResize = useCallback(
    (handle: Handle, event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const img = imgRef.current;
      if (!img) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const startW = img.getBoundingClientRect().width;
      const startH = img.getBoundingClientRect().height;
      const ratio = startW / Math.max(startH, 1);

      const onMove = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        // Lock on by default; Alt = free resize. Lock off: Shift = temporary lock.
        const preserve = lockRatio ? !e.altKey : e.shiftKey;

        let nextW = startW;
        let nextH = startH;

        const affectsW = handle.includes("e") || handle.includes("w");
        const affectsH = handle.includes("n") || handle.includes("s");
        const signW = handle.includes("w") ? -1 : 1;
        const signH = handle.includes("n") ? -1 : 1;

        if (preserve) {
          if (affectsW && !affectsH) {
            nextW = startW + dx * signW;
            nextH = nextW / ratio;
          } else if (affectsH && !affectsW) {
            nextH = startH + dy * signH;
            nextW = nextH * ratio;
          } else if (Math.abs(dx) >= Math.abs(dy)) {
            nextW = startW + dx * signW;
            nextH = nextW / ratio;
          } else {
            nextH = startH + dy * signH;
            nextW = nextH * ratio;
          }
        } else {
          if (affectsW) nextW = startW + dx * signW;
          if (affectsH) nextH = startH + dy * signH;
        }

        nextW = Math.min(MAX_WIDTH, Math.max(MIN_SIZE, nextW));
        nextH = Math.max(MIN_SIZE, nextH);
        if (preserve) {
          nextH = nextW / ratio;
          if (nextH < MIN_SIZE) {
            nextH = MIN_SIZE;
            nextW = nextH * ratio;
          }
        }

        setPreview({ w: Math.round(nextW), h: Math.round(nextH) });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setPreview((current) => {
          if (current) {
            updateAttributes({
              width: current.w,
              height: current.h,
            });
          }
          return null;
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [lockRatio, updateAttributes]
  );

  useEffect(() => {
    const img = imgRef.current;
    if (!img || width) return;
    const applyNatural = () => {
      if (!img.naturalWidth) return;
      const max = Math.min(img.naturalWidth, 640);
      const scale = max / img.naturalWidth;
      updateAttributes({
        width: Math.round(img.naturalWidth * scale),
        height: Math.round(img.naturalHeight * scale),
      });
    };
    if (img.complete) applyNatural();
    else img.addEventListener("load", applyNatural, { once: true });
  }, [width, updateAttributes]);

  return (
    <NodeViewWrapper
      as="div"
      className="editor-image-node relative my-4 inline-block max-w-full"
    >
      <div
        className={cn(
          "relative inline-block max-w-full",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-card"
        )}
        style={{
          width: displayW ? `${displayW}px` : undefined,
          maxWidth: "100%",
        }}
      >
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          title={node.attrs.title || ""}
          width={displayW}
          height={displayH}
          className="block h-auto max-w-full rounded-md object-contain"
          style={{
            width: displayW ? `${displayW}px` : undefined,
            height: displayH && !lockRatio ? `${displayH}px` : "auto",
          }}
          draggable={false}
        />

        {selected && (
          <>
            {HANDLES.map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Resize ${handle}`}
                className={handleClass(handle)}
                onPointerDown={(e) => startResize(handle, e)}
              />
            ))}

            <div
              className="absolute top-2 right-2 flex flex-wrap items-center gap-1"
              contentEditable={false}
            >
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shadow-md"
                title={
                  lockRatio
                    ? "Aspect ratio locked (hold Alt while dragging for free resize)"
                    : "Free resize (hold Shift while dragging to lock ratio)"
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLockRatio((v) => !v);
                }}
              >
                {lockRatio ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                {lockRatio ? "Lock" : "Free"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="shadow-md"
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
            </div>

            {(preview || (width && height)) && (
              <span className="absolute bottom-2 left-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow">
                {preview?.w ?? width}×{preview?.h ?? height}
                {lockRatio ? " · ratio" : " · free"}
              </span>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const w =
            element.getAttribute("width") ||
            (element as HTMLElement).style.width;
          if (!w) return null;
          const n = parseInt(String(w), 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            width: attributes.width,
            style: `width: ${attributes.width}px; height: auto;`,
          };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const h =
            element.getAttribute("height") ||
            (element as HTMLElement).style.height;
          if (!h || h === "auto") return null;
          const n = parseInt(String(h), 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

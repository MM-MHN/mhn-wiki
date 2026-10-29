import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Lock,
  Unlock,
  Trash2,
} from "lucide-react";
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

type CaptionPosition = "above" | "below";

const HANDLES: Handle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const MIN_SIZE = 48;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 360;

function fluidWidthStyle(px: number | null | undefined): string {
  if (!px) return "min(100%, fit-content)";
  return `min(100%, ${px}px)`;
}

function handleClass(handle: Handle): string {
  // Outer hit target ≥40px; visible knob stays compact
  const base =
    "absolute z-10 flex h-10 w-10 items-center justify-center touch-manipulation";
  switch (handle) {
    case "n":
      return cn(
        base,
        "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-n-resize"
      );
    case "s":
      return cn(
        base,
        "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize"
      );
    case "e":
      return cn(
        base,
        "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-e-resize"
      );
    case "w":
      return cn(
        base,
        "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-w-resize"
      );
    case "ne":
      return cn(
        base,
        "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize"
      );
    case "nw":
      return cn(
        base,
        "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize"
      );
    case "se":
      return cn(
        base,
        "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize"
      );
    case "sw":
      return cn(
        base,
        "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize"
      );
  }
}

function caretOnFirstLine(el: HTMLTextAreaElement) {
  return !el.value.slice(0, el.selectionStart).includes("\n");
}

function caretOnLastLine(el: HTMLTextAreaElement) {
  return !el.value.slice(el.selectionStart).includes("\n");
}

function CaptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 20)}px`;
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  const exitCaption = () => {
    ref.current?.blur();
  };

  return (
    <textarea
      ref={ref}
      className="image-caption-input"
      value={value}
      rows={1}
      placeholder="Type a caption…"
      aria-label="Image caption"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          exitCaption();
          return;
        }
        if (e.key === "Enter") return;
        if (e.key === "ArrowDown" && caretOnLastLine(e.currentTarget)) {
          e.preventDefault();
          exitCaption();
          return;
        }
        if (e.key === "ArrowUp" && caretOnFirstLine(e.currentTarget)) {
          e.preventDefault();
          exitCaption();
        }
      }}
      onKeyUp={(e) => e.stopPropagation()}
      onChange={(e) => {
        onChange(e.target.value);
        requestAnimationFrame(syncHeight);
      }}
    />
  );
}

function captionToDomSpec(caption: string): DOMOutputSpec {
  const lines = caption.replace(/\r\n/g, "\n").split("\n");
  const children: Array<string | DOMOutputSpec> = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(["br", {}]);
    children.push(line);
  });
  return [
    "figcaption",
    { class: "image-caption" },
    ...children,
  ] as unknown as DOMOutputSpec;
}

function captionFromElement(el: HTMLElement): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || "");
      return;
    }
    if (node.nodeName === "BR") {
      parts.push("\n");
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(el);
  return parts.join("").replace(/\r\n/g, "\n");
}

function applyWrapperStyles(img: HTMLImageElement, preferredW: number | null) {
  const wrappers = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".ProseMirror [data-node-view-wrapper].editor-image-node-root, .ProseMirror [data-node-view-wrapper].editor-image-node"
    )
  ).filter((el) => el.contains(img));

  const widthValue = fluidWidthStyle(preferredW);
  for (const el of wrappers) {
    el.style.setProperty("display", "inline-flex", "important");
    el.style.setProperty("flex-direction", "column", "important");
    el.style.setProperty("align-items", "stretch", "important");
    el.style.setProperty("vertical-align", "middle", "important");
    el.style.setProperty("width", widthValue, "important");
    el.style.setProperty("max-width", "100%", "important");
    el.style.setProperty("box-sizing", "border-box", "important");
    el.style.setProperty("margin", "0.5rem 1rem 0.5rem 0", "important");
    if (preferredW) {
      el.style.setProperty("--editor-img-w", `${preferredW}px`);
    } else {
      el.style.removeProperty("--editor-img-w");
    }
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
  const [loaded, setLoaded] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  const width = (node.attrs.width as number | null) ?? null;
  const height = (node.attrs.height as number | null) ?? null;
  const caption = (node.attrs.caption as string) || "";
  const captionPosition =
    ((node.attrs.captionPosition as CaptionPosition) || "below") === "above"
      ? "above"
      : "below";
  const preferredW = preview?.w ?? width ?? null;
  const preferredH = preview?.h ?? height ?? null;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    applyWrapperStyles(img, preferredW);
  }, [preferredW, captionPosition, selected, caption, loaded]);

  const startResize = useCallback(
    (handle: Handle, event: ReactPointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const img = imgRef.current;
      if (!img) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const startW = img.getBoundingClientRect().width;
      const startH = img.getBoundingClientRect().height;
      const ratio = startW / Math.max(startH, 1);
      const prose = img.closest(".ProseMirror") as HTMLElement | null;
      const containerMax = Math.max(
        MIN_SIZE,
        Math.min(MAX_WIDTH, prose?.clientWidth ?? MAX_WIDTH)
      );

      const onMove = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
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
          } else {
            nextW = startW + dx * signW;
            nextH = nextW / ratio;
          }
        } else {
          if (affectsW) nextW = startW + dx * signW;
          if (affectsH) nextH = startH + dy * signH;
        }

        nextW = Math.min(containerMax, Math.max(MIN_SIZE, nextW));
        nextH = Math.max(MIN_SIZE, nextH);
        setPreview({ w: Math.round(nextW), h: Math.round(nextH) });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setPreview((p) => {
          if (p) {
            updateAttributes({
              width: p.w,
              height: lockRatio ? null : p.h,
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

  const markLoaded = useCallback(() => {
    const img = imgRef.current;
    if (img?.naturalWidth && img.naturalHeight) {
      setNaturalRatio(img.naturalWidth / img.naturalHeight);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth) markLoaded();
  }, [markLoaded, node.attrs.src]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || width) return;
    const applyNatural = () => {
      if (!img.naturalWidth) return;
      const prose = img.closest(".ProseMirror") as HTMLElement | null;
      const containerMax = Math.min(
        MAX_WIDTH,
        prose?.clientWidth || DEFAULT_WIDTH,
        DEFAULT_WIDTH
      );
      updateAttributes({
        width: Math.min(containerMax, img.naturalWidth),
      });
    };
    if (img.complete && img.naturalWidth) applyNatural();
    else img.addEventListener("load", applyNatural, { once: true });
  }, [width, updateAttributes]);

  const skeletonAspect =
    preferredW && preferredH
      ? preferredW / preferredH
      : naturalRatio || (preferredW ? preferredW / (preferredW * 0.66) : 16 / 10);

  const stackStyle: CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "stretch",
    verticalAlign: "middle",
    width: fluidWidthStyle(preferredW),
    maxWidth: "100%",
    boxSizing: "border-box",
    margin: "0.5rem 1rem 0.5rem 0",
    ["--editor-img-w" as string]: preferredW ? `${preferredW}px` : undefined,
  };

  const captionEl = (
    <div
      className="editor-image-caption-slot"
      contentEditable={false}
      data-caption-position={captionPosition}
    >
      <CaptionField
        value={caption}
        onChange={(next) => updateAttributes({ caption: next })}
      />
    </div>
  );

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "editor-image-node",
        selected && "is-selected",
        !loaded && "is-loading"
      )}
      data-caption-position={captionPosition}
      contentEditable={false}
      style={stackStyle}
    >
      {captionPosition === "above" && captionEl}

      <div className="editor-image-media" contentEditable={false}>
        {!loaded && (
          <div
            className="editor-image-skeleton"
            aria-hidden
            style={{ aspectRatio: String(skeletonAspect) }}
          />
        )}
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          title={node.attrs.title || ""}
          width={preferredW || undefined}
          height={preferredH || undefined}
          className={cn(
            "editor-image-img block h-auto w-full max-w-full rounded-md object-contain transition-opacity duration-300",
            loaded ? "opacity-100" : "absolute inset-0 opacity-0"
          )}
          style={{
            height:
              preferredH && !lockRatio ? `${preferredH}px` : "auto",
            maxHeight: preferredH && !lockRatio ? undefined : "none",
          }}
          draggable={false}
          onLoad={markLoaded}
        />

        {selected && (
          <>
            {HANDLES.map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Resize ${handle}`}
                className={cn("group/handle", handleClass(handle))}
                onPointerDown={(e) => startResize(handle, e)}
              >
                <span className="knob h-3 w-3 rounded-sm border-2 border-primary bg-card shadow-sm transition-transform duration-150 group-hover/handle:scale-110" />
              </button>
            ))}

            <div
              className="editor-image-toolbar absolute top-2 right-2 z-20 flex max-w-[calc(100%-0.5rem)] flex-wrap items-center justify-end gap-1"
              contentEditable={false}
            >
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-10 min-h-10 gap-1 px-2.5 shadow-md sm:h-8 sm:min-h-8"
                title={
                  captionPosition === "below"
                    ? "Move caption above image"
                    : "Move caption below image"
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateAttributes({
                    captionPosition:
                      captionPosition === "below" ? "above" : "below",
                  });
                }}
              >
                {captionPosition === "below" ? (
                  <ArrowUpToLine className="h-4 w-4" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {captionPosition === "below" ? "Caption↑" : "Caption↓"}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-10 min-h-10 gap-1 px-2.5 shadow-md sm:h-8 sm:min-h-8"
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
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {lockRatio ? "Lock" : "Free"}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-10 min-h-10 gap-1 px-2.5 shadow-md sm:h-8 sm:min-h-8"
                title="Remove image"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteNode();
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Remove</span>
              </Button>
            </div>

            {(preview || (width && height)) && (
              <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                {preview?.w ?? width}×{preview?.h ?? height}
                {lockRatio ? " · ratio" : " · free"}
              </span>
            )}
          </>
        )}
      </div>

      {captionPosition === "below" && captionEl}
    </NodeViewWrapper>
  );
}

function pickCaptionFromElement(element: HTMLElement): string {
  const fromData = element.getAttribute("data-caption");
  if (fromData != null) return fromData.replace(/\\n/g, "\n");
  if (element.tagName === "FIGURE") {
    const fc = element.querySelector("figcaption");
    if (fc) return captionFromElement(fc);
  }
  const parent = element.parentElement;
  if (parent?.tagName === "FIGURE") {
    const fc = parent.querySelector("figcaption");
    if (fc) return captionFromElement(fc);
  }
  return "";
}

function pickCaptionPosition(element: HTMLElement): CaptionPosition {
  const raw =
    element.getAttribute("data-caption-position") ||
    element.parentElement?.getAttribute("data-caption-position") ||
    "";
  if (raw === "above") return "above";
  if (
    element.tagName === "FIGURE" ||
    element.parentElement?.tagName === "FIGURE"
  ) {
    const fig =
      element.tagName === "FIGURE" ? element : element.parentElement!;
    const first = fig.firstElementChild;
    if (first?.tagName === "FIGCAPTION") return "above";
  }
  return "below";
}

export const ResizableImage = Image.extend({
  inline: true,
  group: "inline",
  selectable: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const w =
            element.getAttribute("width") ||
            (element as HTMLElement).style.width ||
            element.getAttribute("data-width");
          if (!w) return null;
          const n = parseInt(String(w), 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {
              style: "max-width:100%;height:auto;",
            };
          }
          return {
            width: attributes.width,
            "data-width": attributes.width,
            style: `width:min(100%,${attributes.width}px);max-width:100%;height:auto;`,
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
      caption: {
        default: "",
        parseHTML: (element) => pickCaptionFromElement(element as HTMLElement),
        renderHTML: () => ({}),
      },
      captionPosition: {
        default: "below" as CaptionPosition,
        parseHTML: (element) => pickCaptionPosition(element as HTMLElement),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-type='image-figure']",
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const img = el.querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            width: img.getAttribute("width")
              ? parseInt(img.getAttribute("width")!, 10)
              : img.getAttribute("data-width")
                ? parseInt(img.getAttribute("data-width")!, 10)
                : null,
            height: img.getAttribute("height")
              ? parseInt(img.getAttribute("height")!, 10)
              : null,
            caption: pickCaptionFromElement(el),
            captionPosition: pickCaptionPosition(el),
          };
        },
      },
      {
        tag: "img[src]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const caption = String(node.attrs.caption || "").trim();
    const position =
      node.attrs.captionPosition === "above" ? "above" : "below";

    const {
      caption: _c,
      captionPosition: _p,
      ...imgAttrs
    } = HTMLAttributes as Record<string, unknown>;

    const baseClass = String(this.options.HTMLAttributes?.class || "");
    const img: DOMOutputSpec = [
      "img",
      mergeAttributes(this.options.HTMLAttributes, imgAttrs, {
        class: [baseClass, "editor-inline-image"]
          .filter(Boolean)
          .join(" "),
        loading: "lazy",
        decoding: "async",
      }),
    ];

    if (!caption) {
      return img;
    }

    const figcaption = captionToDomSpec(caption);
    if (
      Array.isArray(figcaption) &&
      figcaption[1] &&
      typeof figcaption[1] === "object"
    ) {
      (figcaption[1] as Record<string, string>)["data-caption-position"] =
        position;
    }

    const children =
      position === "above" ? [figcaption, img] : [img, figcaption];

    const w = node.attrs.width as number | null;
    const figureStyle = [
      "display:inline-flex",
      "flex-direction:column",
      "align-items:stretch",
      "vertical-align:middle",
      "max-width:100%",
      "margin:0.5rem 1rem 0.5rem 0",
      "box-sizing:border-box",
      `width:${fluidWidthStyle(w)}`,
      w ? `--editor-img-w:${w}px` : "",
    ]
      .filter(Boolean)
      .join(";");

    return [
      "figure",
      {
        "data-type": "image-figure",
        "data-caption-position": position,
        class: "image-figure",
        style: figureStyle,
      },
      ...children,
    ] as unknown as DOMOutputSpec;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView, {
      as: "span",
      className: "editor-image-node-root",
    });
  },
});

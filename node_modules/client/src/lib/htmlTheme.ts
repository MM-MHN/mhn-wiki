/** Relative luminance (0–1) for sRGB. */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function parseCssColor(
  input: string
): { r: number; g: number; b: number } | null {
  const s = input.trim().toLowerCase();
  if (!s || s === "inherit" || s === "currentcolor" || s === "transparent") {
    return null;
  }

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgb = s.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/
  );
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return null;
}

/**
 * TipTap Color / paste often stores light-theme colors (near-black, navy)
 * as inline styles. Those become unreadable on dark backgrounds — strip them
 * so theme text color can apply. Bright accent colors are kept.
 */
export function adaptHtmlColorsForTheme(
  html: string,
  theme: "light" | "dark"
): string {
  if (!html.trim() || typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(
    `<div id="__wiki_root">${html}</div>`,
    "text/html"
  );
  const root = doc.getElementById("__wiki_root");
  if (!root) return html;

  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const color = el.style.color;
    if (!color) return;
    const rgb = parseCssColor(color);
    if (!rgb) return;
    const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);

    // Dark theme: remove dark / mid-dark text colors (unreadable on navy bg)
    if (theme === "dark" && lum < 0.55) {
      el.style.removeProperty("color");
      if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
      return;
    }

    // Light theme: remove near-white text colors
    if (theme === "light" && lum > 0.82) {
      el.style.removeProperty("color");
      if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
    }
  });

  return root.innerHTML;
}

import { mergeAttributes } from "@tiptap/core";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

function styleFromAttrs(attrs: {
  backgroundColor?: string | null;
  textAlign?: string | null;
}) {
  const parts: string[] = [];
  if (attrs.backgroundColor) {
    parts.push(`background-color: ${attrs.backgroundColor}`);
  }
  if (attrs.textAlign) {
    parts.push(`text-align: ${attrs.textAlign}`);
  }
  return parts.length ? { style: parts.join("; ") } : {};
}

const cellExtraAttributes = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute("data-background-color") ||
      element.style.backgroundColor ||
      null,
    renderHTML: (attributes: { backgroundColor?: string | null }) => {
      if (!attributes.backgroundColor) return {};
      return {
        "data-background-color": attributes.backgroundColor,
      };
    },
  },
  textAlign: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute("data-text-align") ||
      element.style.textAlign ||
      null,
    renderHTML: (attributes: { textAlign?: string | null }) => {
      if (!attributes.textAlign) return {};
      return {
        "data-text-align": attributes.textAlign,
      };
    },
  },
};

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellExtraAttributes,
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "td",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        styleFromAttrs(node.attrs)
      ),
      0,
    ];
  },
});

export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellExtraAttributes,
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "th",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        styleFromAttrs(node.attrs)
      ),
      0,
    ];
  },
});

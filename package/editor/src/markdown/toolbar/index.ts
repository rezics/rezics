import type { ToolbarItem } from "../../toolbar/types";
import {
  insertImage,
  insertLink,
  insertTable,
  toggleBlockquote,
  toggleBold,
  toggleCodeBlock,
  toggleHeading,
  toggleItalic,
  toggleOrderedList,
  toggleUnorderedList,
} from "../core/commands";

export const markdownToolbarItems: ToolbarItem[] = [
  { name: "bold", label: "Bold", action: toggleBold },
  { name: "italic", label: "Italic", action: toggleItalic },
  { name: "heading", label: "Heading", action: toggleHeading },
  { name: "blockquote", label: "Quote", action: toggleBlockquote },
  { name: "unordered-list", label: "Bullet List", action: toggleUnorderedList },
  { name: "ordered-list", label: "Numbered List", action: toggleOrderedList },
  { name: "link", label: "Link", action: insertLink },
  { name: "image", label: "Image", action: insertImage },
  { name: "table", label: "Table", action: insertTable },
  { name: "code-block", label: "Code", action: toggleCodeBlock },
];

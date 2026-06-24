import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";

const jsonHighlightStyle = HighlightStyle.define([
  // Object keys
  // 对象键名
  { tag: tags.propertyName, color: "#1976d2" },

  // Values
  // 值
  { tag: tags.string, color: "#1a7f37" },
  { tag: tags.number, color: "#8250df" },
  { tag: tags.bool, color: "#0078D4", fontWeight: "bold" },
  { tag: tags.null, color: "#9a9ea6", fontStyle: "italic" },

  // Structural characters
  // 结构字符
  { tag: tags.punctuation, color: "#57606a" },
  { tag: tags.brace, color: "#57606a" },
  { tag: tags.squareBracket, color: "#57606a" },
]);

export function jsonHighlighting(): Extension {
  return syntaxHighlighting(jsonHighlightStyle);
}

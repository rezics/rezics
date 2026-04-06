import type { EditorPlugin } from "../../core/types";
import { markdownToolbarItems } from "../toolbar/index";
import { markdownKeybindings } from "./keybindings";
import {
  type MarkdownLanguageConfig,
  markdownLanguageSupport,
} from "./language";

export function markdown(config?: MarkdownLanguageConfig): EditorPlugin {
  return {
    name: "markdown",
    extensions: markdownLanguageSupport(config),
    keybindings: markdownKeybindings,
    toolbar: markdownToolbarItems,
  };
}

export {
  insertImage,
  insertLink,
  insertTable,
  toggleBlockquote,
  toggleBold,
  toggleCode,
  toggleCodeBlock,
  toggleHeading,
  toggleItalic,
  toggleOrderedList,
  toggleStrikethrough,
  toggleUnorderedList,
} from "./commands";

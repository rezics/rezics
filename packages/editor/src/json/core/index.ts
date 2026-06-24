import type { EditorPlugin } from "../../core/types";
import { jsonToolbarItems } from "../toolbar/index";
import { jsonKeybindings } from "./keybindings";
import { jsonLanguageSupport } from "./language";

export function json(): EditorPlugin {
  return {
    name: "json",
    extensions: jsonLanguageSupport(),
    keybindings: jsonKeybindings,
    toolbar: jsonToolbarItems,
  };
}

export { formatJson } from "./commands";

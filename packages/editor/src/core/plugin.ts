import type { Extension } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";
import type { ToolbarItem } from "../toolbar/types";
import type { EditorPlugin } from "./types";

export interface ResolvedPlugins {
  extensions: Extension[];
  keybindings: KeyBinding[];
  toolbar: ToolbarItem[];
}

export function resolvePlugins(plugins: EditorPlugin[]): ResolvedPlugins {
  const extensions: Extension[] = [];
  const keybindings: KeyBinding[] = [];
  const toolbar: ToolbarItem[] = [];

  for (const plugin of plugins) {
    if (plugin.extensions) {
      if (Array.isArray(plugin.extensions)) {
        extensions.push(...plugin.extensions);
      } else {
        extensions.push(plugin.extensions);
      }
    }
    if (plugin.keybindings) {
      keybindings.push(...plugin.keybindings);
    }
    if (plugin.toolbar) {
      toolbar.push(...plugin.toolbar);
    }
  }

  return { extensions, keybindings, toolbar };
}

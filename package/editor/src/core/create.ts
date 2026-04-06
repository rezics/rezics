import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, type KeyBinding } from "@codemirror/view";
import { mergeKeybindings } from "./keybindings";
import { resolvePlugins } from "./plugin";
import type { EditorPlugin } from "./types";

export function createEditor(options: {
  parent: HTMLElement;
  doc?: string;
  plugins?: EditorPlugin[];
  keybindings?: KeyBinding[];
  theme?: Extension;
}): EditorView {
  const { parent, doc = "", plugins = [], keybindings = [], theme } = options;
  const resolved = resolvePlugins(plugins);

  const extensions: Extension[] = [
    ...resolved.extensions,
    ...mergeKeybindings(keybindings, resolved.keybindings),
    EditorView.lineWrapping,
  ];

  if (theme) {
    extensions.push(theme);
  }

  return new EditorView({
    state: EditorState.create({ doc, extensions }),
    parent,
  });
}

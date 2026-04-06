import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, type KeyBinding } from "@codemirror/view";
import { useCallback, useEffect, useRef, useState } from "react";
import { mergeKeybindings } from "../core/keybindings";
import { resolvePlugins } from "../core/plugin";
import type { EditorPlugin } from "../core/types";

const EMPTY_PLUGINS: EditorPlugin[] = [];
const EMPTY_KEYBINDINGS: KeyBinding[] = [];

export interface UseEditorOptions {
  doc?: string;
  plugins?: EditorPlugin[];
  keybindings?: KeyBinding[];
  theme?: Extension;
  extraExtensions?: Extension[];
  onChange?: (value: string) => void;
}

export function useEditor(options: UseEditorOptions) {
  const {
    doc = "",
    plugins = EMPTY_PLUGINS,
    keybindings = EMPTY_KEYBINDINGS,
    theme,
    extraExtensions,
    onChange,
  } = options;
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [view, setView] = useState<EditorView | null>(null);

  const containerRef = useCallback(
    (node: HTMLElement | null) => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
        setView(null);
      }

      if (!node) return;

      const resolved = resolvePlugins(plugins);

      const extensions: Extension[] = [
        ...resolved.extensions,
        ...mergeKeybindings(keybindings, resolved.keybindings),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ];

      if (theme) {
        extensions.push(theme);
      }

      if (extraExtensions) {
        extensions.push(...extraExtensions);
      }

      const created = new EditorView({
        state: EditorState.create({ doc, extensions }),
        parent: node,
      });
      viewRef.current = created;
      setView(created);
    },
    // Recreate on plugin/keybinding/theme/extension identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plugins, keybindings, theme, extraExtensions, doc],
  );

  // Sync external doc changes without recreating the view
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== doc) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: doc },
      });
    }
  }, [doc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  return { containerRef, view };
}

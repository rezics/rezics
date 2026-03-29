import { useCallback, useEffect, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, type KeyBinding } from '@codemirror/view';
import { resolvePlugins } from '../core/plugin';
import { mergeKeybindings } from '../core/keybindings';
import type { EditorPlugin } from '../core/types';

export interface UseEditorOptions {
  doc?: string;
  plugins?: EditorPlugin[];
  keybindings?: KeyBinding[];
  theme?: Extension;
  onChange?: (value: string) => void;
}

export function useEditor(options: UseEditorOptions) {
  const { doc = '', plugins = [], keybindings = [], theme, onChange } = options;
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const containerRef = useCallback(
    (node: HTMLElement | null) => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
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

      viewRef.current = new EditorView({
        state: EditorState.create({ doc, extensions }),
        parent: node,
      });
    },
    // Recreate on plugin/keybinding/theme identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plugins, keybindings, theme],
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

  return { containerRef, viewRef };
}

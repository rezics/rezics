import { Compartment, EditorState, type Extension } from "@codemirror/state";
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

function buildConfigurable(
  plugins: EditorPlugin[],
  keybindings: KeyBinding[],
  theme: Extension | undefined,
  extraExtensions: Extension[] | undefined,
): Extension[] {
  const resolved = resolvePlugins(plugins);
  const extensions: Extension[] = [
    ...resolved.extensions,
    ...mergeKeybindings(keybindings, resolved.keybindings),
  ];
  if (theme) extensions.push(theme);
  if (extraExtensions) extensions.push(...extraExtensions);
  return extensions;
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
  const docRef = useRef(doc);
  docRef.current = doc;

  // Refs for configurable props, so the stable ref callback can read the
  // latest values when (re)creating the EditorView.
  // 为可配置的 props 保留 refs，使稳定的 ref 回调在（重新）创建 EditorView 时能读取最新值。
  const pluginsRef = useRef(plugins);
  const keybindingsRef = useRef(keybindings);
  const themeRef = useRef(theme);
  const extraExtensionsRef = useRef(extraExtensions);

  // A single Compartment holds all configurable extensions. Swapping its
  // contents via StateEffect.reconfigure preserves selection, focus, history
  // and the DOM node — no destroy/recreate of the view on prop changes.
  // 单个 Compartment 持有所有可配置的扩展。通过 StateEffect.reconfigure 替换其内容可保留选区、焦点、历史记录和 DOM 节点 — props 变化时无需销毁/重建视图。
  const compartmentRef = useRef<Compartment | null>(null);
  if (compartmentRef.current === null) {
    compartmentRef.current = new Compartment();
  }

  const [view, setView] = useState<EditorView | null>(null);

  // Stable ref callback — only fires on actual mount/unmount of the DOM node,
  // never on parent re-renders. This is what makes focus survive typing.
  // 稳定的 ref 回调 — 仅在 DOM 节点实际挂载/卸载时触发，父组件重渲染时不会触发。这正是焦点在输入过程中得以保留的原因。
  const containerRef = useCallback((node: HTMLElement | null) => {
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
      setView(null);
    }

    if (!node) return;

    const compartment = compartmentRef.current!;
    const extensions: Extension[] = [
      compartment.of(
        buildConfigurable(
          pluginsRef.current,
          keybindingsRef.current,
          themeRef.current,
          extraExtensionsRef.current,
        ),
      ),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
    ];

    const created = new EditorView({
      state: EditorState.create({ doc: docRef.current, extensions }),
      parent: node,
    });
    viewRef.current = created;
    setView(created);
  }, []);

  // When configurable props change, reconfigure the compartment in-place
  // instead of tearing down the view. Skip on first mount — the initial
  // config was already applied in containerRef.
  // 当可配置的 props 变化时，就地重新配置 compartment，而不是销毁视图。首次挂载时跳过 — 初始配置已在 containerRef 中应用。
  const isFirstEffect = useRef(true);
  useEffect(() => {
    pluginsRef.current = plugins;
    keybindingsRef.current = keybindings;
    themeRef.current = theme;
    extraExtensionsRef.current = extraExtensions;

    if (isFirstEffect.current) {
      isFirstEffect.current = false;
      return;
    }

    const currentView = viewRef.current;
    const compartment = compartmentRef.current;
    if (!currentView || !compartment) return;

    currentView.dispatch({
      effects: compartment.reconfigure(
        buildConfigurable(plugins, keybindings, theme, extraExtensions),
      ),
    });
  }, [plugins, keybindings, theme, extraExtensions]);

  // Sync external doc changes without recreating the view
  // 在不重建视图的情况下同步外部 doc 的变化
  useEffect(() => {
    const currentView = viewRef.current;
    if (!currentView) return;
    const current = currentView.state.doc.toString();
    if (current !== doc) {
      currentView.dispatch({
        changes: { from: 0, to: current.length, insert: doc },
      });
    }
  }, [doc]);

  useEffect(() => {
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  return { containerRef, view };
}

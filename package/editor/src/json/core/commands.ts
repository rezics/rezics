import { forceLinting } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";

export function formatJson(view: EditorView): boolean {
  const text = view.state.doc.toString();
  try {
    const formatted = JSON.stringify(JSON.parse(text), null, 2);
    if (formatted !== text) {
      view.dispatch({
        changes: { from: 0, to: text.length, insert: formatted },
      });
    }
  } catch {
    // Invalid JSON — trigger lint to show the error if lint plugin is available.
    // 无效的 JSON —— 若 lint 插件可用，则触发 lint 以显示错误。
    try {
      forceLinting(view);
    } catch {
      // Lint plugin not installed, ignore.
      // 未安装 lint 插件，忽略。
    }
  }
  return true;
}

import type { EditorView } from '@codemirror/view';
import { forceLinting } from '@codemirror/lint';

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
    // Invalid JSON — trigger lint to show the error if lint plugin is available
    try {
      forceLinting(view);
    } catch {
      // Lint plugin not installed, ignore
    }
  }
  return true;
}

import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * CodeMirror extension that makes the editor fill its container height
 * and handle its own scrolling. Apply only in fixed-height (resize) mode.
 */
export const fixedHeightEditor: Extension = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content, .cm-gutter": { minHeight: "100%" },
});

import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

function wheelDeltaY(event: WheelEvent, viewportHeight: number): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * viewportHeight;
  }
  return event.deltaY;
}

/**
 * CodeMirror extension that makes the editor fill its container height
 * and handle its own scrolling. Apply only in fixed-height (resize) mode.
 */
export const fixedHeightEditor: Extension = [
  EditorView.theme({
    "&": { height: "100%" },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content, .cm-gutter": { minHeight: "100%" },
  }),
  EditorView.domEventHandlers({
    wheel(event, view) {
      if (event.defaultPrevented || event.ctrlKey) return false;

      const deltaY = wheelDeltaY(event, view.scrollDOM.clientHeight);
      if (deltaY === 0 || Math.abs(deltaY) < Math.abs(event.deltaX)) {
        return false;
      }

      const scroller = view.scrollDOM;
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      if (maxScrollTop <= 0) return false;

      const nextScrollTop = Math.max(
        0,
        Math.min(maxScrollTop, scroller.scrollTop + deltaY),
      );
      if (nextScrollTop === scroller.scrollTop) return false;

      scroller.scrollTop = nextScrollTop;
      event.preventDefault();
      return true;
    },
  }),
];

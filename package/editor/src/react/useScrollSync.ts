import { EditorView } from "@codemirror/view";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

type ViewMode = "write" | "preview" | "dual";
type SyncSource = "editor" | "preview" | null;

const GUARD_TIMEOUT_MS = 50;

/**
 * Finds the closest `[data-source-line]` element at or before the given line number.
 * Returns the element whose `data-source-line` is <= `line`, preferring the highest match.
 */
function findSourceLineElement(
  container: HTMLElement,
  line: number,
): HTMLElement | null {
  const elements =
    container.querySelectorAll<HTMLElement>("[data-source-line]");
  let best: HTMLElement | null = null;
  for (const el of elements) {
    const elLine = parseInt(el.dataset.sourceLine!, 10);
    if (elLine <= line) best = el;
    else break; // elements are in document order (ascending line numbers)
  }
  return best;
}

/**
 * Finds the topmost visible `[data-source-line]` element in the container.
 */
function findTopVisibleSourceLine(container: HTMLElement): number | null {
  const containerRect = container.getBoundingClientRect();
  const elements =
    container.querySelectorAll<HTMLElement>("[data-source-line]");
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    // Element is at or below the container's top edge
    if (rect.bottom > containerRect.top) {
      return parseInt(el.dataset.sourceLine!, 10);
    }
  }
  return null;
}

/**
 * Bidirectional scroll synchronization between a CodeMirror editor and a
 * markdown preview container in dual-column mode.
 *
 * - Editor → preview: maps the top visible editor line to a `[data-source-line]`
 *   element in the preview and scrolls it into view.
 * - Preview → editor: finds the topmost visible annotated element and scrolls
 *   the editor to the corresponding source line.
 * - Prevents feedback loops via a sync-source guard with a short timeout.
 * - Restores preview scroll position after innerHTML replacement via MutationObserver.
 */
export function useScrollSync(
  view: EditorView | null,
  previewRef: RefObject<HTMLDivElement | null>,
  viewMode: ViewMode,
) {
  const syncSourceRef = useRef<SyncSource>(null);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the editor's top visible line so we can restore it when the editor
  // becomes hidden (display:none resets scrollTop to 0).
  const lastEditorLineRef = useRef<number>(0);

  // Always track the editor's scroll position, regardless of viewMode.
  useEffect(() => {
    if (!view) return;
    const scrollDOM = view.scrollDOM;
    const track = () => {
      const topLine = view.lineBlockAtHeight(scrollDOM.scrollTop);
      lastEditorLineRef.current =
        view.state.doc.lineAt(topLine.from).number - 1;
    };
    scrollDOM.addEventListener("scroll", track, { passive: true });
    return () => scrollDOM.removeEventListener("scroll", track);
  }, [view]);

  // When switching to a mode that shows the preview, sync preview position
  // from the last known editor line.
  useEffect(() => {
    if (viewMode === "write" || !view || !previewRef.current) return;
    const preview = previewRef.current;

    // Wait one frame so the preview innerHTML has been rendered.
    const raf = requestAnimationFrame(() => {
      const target = findSourceLineElement(preview, lastEditorLineRef.current);
      if (target) {
        const previewRect = preview.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        preview.scrollTop =
          targetRect.top - previewRect.top + preview.scrollTop;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [view, previewRef, viewMode]);

  useEffect(() => {
    if (viewMode !== "dual" || !view || !previewRef.current) return;

    const preview = previewRef.current;
    const scrollDOM = view.scrollDOM;

    function clearGuard() {
      if (guardTimerRef.current !== null) {
        clearTimeout(guardTimerRef.current);
        guardTimerRef.current = null;
      }
    }

    function setGuard(source: SyncSource) {
      clearGuard();
      syncSourceRef.current = source;
      guardTimerRef.current = setTimeout(() => {
        syncSourceRef.current = null;
        guardTimerRef.current = null;
      }, GUARD_TIMEOUT_MS);
    }

    // Editor → preview sync
    function handleEditorScroll() {
      if (syncSourceRef.current === "preview") return;
      setGuard("editor");

      const topLine = view!.lineBlockAtHeight(scrollDOM.scrollTop);
      const lineNumber = view!.state.doc.lineAt(topLine.from).number - 1; // 0-based

      const target = findSourceLineElement(preview, lineNumber);
      if (target) {
        const previewRect = preview.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - previewRect.top + preview.scrollTop;
        preview.scrollTop = offset;
      }
    }

    // Preview → editor sync
    function handlePreviewScroll() {
      if (syncSourceRef.current === "editor") return;
      setGuard("preview");

      const lineNumber = findTopVisibleSourceLine(preview);
      if (lineNumber === null) return;

      // Convert 0-based source line to 1-based doc line
      const docLine = Math.min(lineNumber + 1, view!.state.doc.lines);
      const lineInfo = view!.state.doc.line(docLine);
      // Set scrollTop directly instead of using EditorView.scrollIntoView,
      // which can scroll ancestor containers and cause the parent page to move.
      const block = view!.lineBlockAt(lineInfo.from);
      scrollDOM.scrollTop = block.top;
    }

    // Post-re-render scroll restoration via MutationObserver
    const observer = new MutationObserver(() => {
      queueMicrotask(() => {
        // After innerHTML replacement, re-sync preview from editor position
        const topLine = view!.lineBlockAtHeight(scrollDOM.scrollTop);
        const lineNumber = view!.state.doc.lineAt(topLine.from).number - 1;
        const target = findSourceLineElement(preview, lineNumber);
        if (target) {
          const previewRect = preview.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const offset = targetRect.top - previewRect.top + preview.scrollTop;
          // Set guard to prevent the resulting scroll event from triggering reverse sync
          setGuard("editor");
          preview.scrollTop = offset;
        }
      });
    });

    observer.observe(preview, { childList: true, subtree: false });
    scrollDOM.addEventListener("scroll", handleEditorScroll, { passive: true });
    preview.addEventListener("scroll", handlePreviewScroll, { passive: true });

    return () => {
      clearGuard();
      observer.disconnect();
      scrollDOM.removeEventListener("scroll", handleEditorScroll);
      preview.removeEventListener("scroll", handlePreviewScroll);
    };
  }, [view, previewRef, viewMode]);
}

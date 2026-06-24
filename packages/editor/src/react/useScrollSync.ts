import type { EditorView } from "@codemirror/view";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

type ViewMode = "write" | "preview" | "dual";
type SyncSource = "editor" | "preview" | null;

const GUARD_TIMEOUT_MS = 50;

/**
 * Finds the closest `[data-source-line]` element at or before the given line number.
 * Returns the element whose `data-source-line` is <= `line`, preferring the highest match.
 * 查找在给定行号处或之前最接近的 `[data-source-line]` 元素。
 * 返回 `data-source-line` <= `line` 的元素，优先选择匹配的最大值。
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
    else break; // elements are in document order (ascending line numbers) — 元素按文档顺序排列（行号升序）
  }
  return best;
}

/**
 * Finds the topmost visible `[data-source-line]` element in the container.
 * 查找容器中最顶部可见的 `[data-source-line]` 元素。
 */
function findTopVisibleSourceLine(container: HTMLElement): number | null {
  const containerRect = container.getBoundingClientRect();
  const elements =
    container.querySelectorAll<HTMLElement>("[data-source-line]");
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    // Element is at or below the container's top edge
    // 元素位于容器顶部边缘处或下方
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
 *
 * CodeMirror 编辑器与双栏模式下的 markdown 预览容器之间的双向滚动同步。
 * - 编辑器 → 预览：将顶部可见的编辑器行映射到预览中的 `[data-source-line]`
 *   元素并将其滚动到可见区域。
 * - 预览 → 编辑器：查找最顶部可见的带注解元素，并将编辑器滚动到对应的源代码行。
 * - 通过带有短超时的同步源守卫防止反馈循环。
 * - 通过 MutationObserver 在 innerHTML 替换后恢复预览的滚动位置。
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
  // 跟踪编辑器顶部可见行，以便在编辑器变为隐藏时恢复它
  //（display:none 会将 scrollTop 重置为 0）。
  const lastEditorLineRef = useRef<number>(0);

  // Always track the editor's scroll position, regardless of viewMode.
  // 始终跟踪编辑器的滚动位置，无论 viewMode 为何。
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
  // 切换到显示预览的模式时，根据最后已知的编辑器行同步预览位置。
  useEffect(() => {
    if (viewMode === "write" || !view || !previewRef.current) return;
    const preview = previewRef.current;

    // Wait one frame so the preview innerHTML has been rendered.
    // 等待一帧，确保预览的 innerHTML 已渲染完成。
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
    // 编辑器 → 预览同步
    function handleEditorScroll() {
      if (syncSourceRef.current === "preview") return;
      setGuard("editor");

      const topLine = view!.lineBlockAtHeight(scrollDOM.scrollTop);
      const lineNumber = view!.state.doc.lineAt(topLine.from).number - 1; // 0-based — 从 0 开始

      const target = findSourceLineElement(preview, lineNumber);
      if (target) {
        const previewRect = preview.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - previewRect.top + preview.scrollTop;
        preview.scrollTop = offset;
      }
    }

    // Preview → editor sync
    // 预览 → 编辑器同步
    function handlePreviewScroll() {
      if (syncSourceRef.current === "editor") return;
      setGuard("preview");

      const lineNumber = findTopVisibleSourceLine(preview);
      if (lineNumber === null) return;

      // Convert 0-based source line to 1-based doc line
      // 将从 0 开始的源代码行转换为从 1 开始的文档行
      const docLine = Math.min(lineNumber + 1, view!.state.doc.lines);
      const lineInfo = view!.state.doc.line(docLine);
      // Set scrollTop directly instead of using EditorView.scrollIntoView,
      // which can scroll ancestor containers and cause the parent page to move.
      // 直接设置 scrollTop，而不使用 EditorView.scrollIntoView，
      // 后者可能滚动祖先容器并导致父页面移动。
      const block = view!.lineBlockAt(lineInfo.from);
      scrollDOM.scrollTop = block.top;
    }

    // Post-re-render scroll restoration via MutationObserver
    // 通过 MutationObserver 在重新渲染后恢复滚动位置
    const observer = new MutationObserver(() => {
      queueMicrotask(() => {
        // After innerHTML replacement, re-sync preview from editor position
        // innerHTML 替换后，根据编辑器位置重新同步预览
        const topLine = view!.lineBlockAtHeight(scrollDOM.scrollTop);
        const lineNumber = view!.state.doc.lineAt(topLine.from).number - 1;
        const target = findSourceLineElement(preview, lineNumber);
        if (target) {
          const previewRect = preview.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const offset = targetRect.top - previewRect.top + preview.scrollTop;
          // Set guard to prevent the resulting scroll event from triggering reverse sync
          // 设置守卫以防止由此产生的滚动事件触发反向同步
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

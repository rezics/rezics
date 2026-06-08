import type { FolioContent, FolioNode } from "./types";

// ---------------------------------------------------------------------------
// Fallback text for demo fixtures (themes, modes)
// 演示用 fixtures（主题、模式）的后备文本
// ---------------------------------------------------------------------------

/**
 * Minimal placeholder for fixtures that demonstrate visual behavior.
 * 用于演示视觉行为的 fixtures 的最小占位文本。
 */
export const FALLBACK_TEXT =
  "This is placeholder text for demonstrating themes and reading modes. Upload a file in the Interactive fixture to read real content.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

// ---------------------------------------------------------------------------
// Tree builder
// 树构建器
// ---------------------------------------------------------------------------

interface ChapterInput {
  id: string;
  title: string;
  content: string;
  contentType?: string;
}

/**
 * Wraps chapter data into a `FolioNode[]` tree where each node's `fetch()`
 * returns a synchronously-resolving promise with the chapter's content.
 * 将章节数据包装成 `FolioNode[]` 树，其中每个节点的 `fetch()` 返回一个同步解析、携带章节内容的 promise。
 */
export function buildTree(
  chapters: ChapterInput[],
  defaultContentType = "text/plain",
): FolioNode[] {
  return chapters.map(({ id, title, content, contentType }) => ({
    id,
    title,
    fetch: (_signal: AbortSignal): Promise<FolioContent> =>
      Promise.resolve({
        contentType: contentType ?? defaultContentType,
        raw: content,
      }),
  }));
}

// ---------------------------------------------------------------------------
// Fixture container style
// Fixture 容器样式
// ---------------------------------------------------------------------------

/**
 * Standard sizing for fixture wrappers so content fills the viewport.
 * fixture 包装容器的标准尺寸，使内容填满视口。
 */
export const WRAPPER_STYLE: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
};

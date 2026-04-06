import type { FolioContent, FolioNode } from "./types";

// ---------------------------------------------------------------------------
// Fallback text for demo fixtures (themes, modes)
// ---------------------------------------------------------------------------

/** Minimal placeholder for fixtures that demonstrate visual behavior. */
export const FALLBACK_TEXT =
  "This is placeholder text for demonstrating themes and reading modes. Upload a file in the Interactive fixture to read real content.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

// ---------------------------------------------------------------------------
// Tree builder
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
// ---------------------------------------------------------------------------

/** Standard sizing for fixture wrappers so content fills the viewport. */
export const WRAPPER_STYLE: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
};

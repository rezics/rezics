import type { ContinueReadingItem, ResumeRoute } from "@rezics/contract";

/**
 * Map a server-resolved `resumeRoute` to an app href. The server already
 * chose the route kind (node preserves multi-link TOC disambiguation); the
 * client only formats the URL.
 */
export function resumeRouteToHref(route: ResumeRoute): string {
  switch (route.kind) {
    case "node":
      return `/book/${route.bookId}/node/${route.nodeId}`;
    case "chapter":
      return `/book/${route.bookId}/read/${route.chapterId}`;
    case "book":
      return `/book/${route.bookId}`;
  }
}

/** Reading completion ratio in [0, 1]; 0 when the book has no countable nodes. */
export function continueReadingProgress(item: ContinueReadingItem): number {
  if (item.chaptersTotal <= 0) return 0;
  return Math.min(1, item.chaptersCompleted / item.chaptersTotal);
}

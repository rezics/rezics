import type { ContinueReadingItem, ResumeRoute } from "@rezics/contract";

/**
 * Map a server-resolved `resumeRoute` to an app href. The server already
 * chose the route kind (node preserves multi-link TOC disambiguation); the
 * client only formats the URL.
 * 将服务端解析的 `resumeRoute` 映射为应用内的 href。服务端已选定路由类型
 * （node 保留多链接目录的消歧）；客户端仅负责格式化 URL。
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

/** Reading completion ratio in [0, 1]; 0 when the book has no countable nodes. 阅读完成比例，范围 [0, 1]；当书籍没有可计数的节点时为 0。 */
export function continueReadingProgress(item: ContinueReadingItem): number {
  if (item.chaptersTotal <= 0) return 0;
  return Math.min(1, item.chaptersCompleted / item.chaptersTotal);
}

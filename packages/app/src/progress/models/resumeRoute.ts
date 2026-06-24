import type { ResumeRoute } from "@rezics/contract";

/**
 * Map a server-resolved `resumeRoute` to an app href. The server already
 * chose the route kind; the client only formats the URL.
 * 将服务端解析的 `resumeRoute` 映射为应用内的 href。服务端已选定路由类型；
 * 客户端仅负责格式化 URL。
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

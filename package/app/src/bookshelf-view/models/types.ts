import type { LibraryKind } from "@rezics/contract";

/**
 * A single library item rendered in the bookshelf grid.
 * 在书架网格中渲染的单个书库条目。
 */
export interface BookshelfItem {
  unitId: string;
  kind: LibraryKind;
  title: string;
  coverUrl: string;
  author?: string;
  /**
   * Books only: whether the viewer can actually open/read the item.
   * 仅书籍：查看者是否真的可以打开/阅读该条目。
   */
  isLicensed?: boolean;
  href: string;
  /**
   * Per-book chapter-completion counter, sourced from a server-aggregated DTO
   * (e.g. `DashboardSummary.continueReading`). Present only when the book has
   * countable chapters and the viewer has progress; absent otherwise so cards
   * omit the counter rather than render "0/0".
   * 单本书的章节完成计数，来自服务端聚合的 DTO
   * （例如 `DashboardSummary.continueReading`）。仅当书籍有可计数的章节
   * 且查看者有进度时才存在；否则缺失，使卡片省略该计数而非渲染 "0/0"。
   */
  chaptersCompleted?: number;
  chaptersTotal?: number;
  /**
   * Viewer's last-read chapter title, shown in the hover preview.
   * 查看者最后阅读的章节标题，显示在悬停预览中。
   */
  lastReadChapterTitle?: string;
}

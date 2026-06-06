import type { LibraryKind } from "@rezics/contract";

/** A single library item rendered in the bookshelf grid. */
export interface BookshelfItem {
  unitId: string;
  kind: LibraryKind;
  title: string;
  coverUrl: string;
  author?: string;
  /** Books only: whether the viewer can actually open/read the item. */
  isLicensed?: boolean;
  href: string;
  /**
   * Per-book chapter-completion counter, sourced from a server-aggregated DTO
   * (e.g. `DashboardSummary.continueReading`). Present only when the book has
   * countable chapters and the viewer has progress; absent otherwise so cards
   * omit the counter rather than render "0/0".
   */
  chaptersCompleted?: number;
  chaptersTotal?: number;
  /** Viewer's last-read chapter title, shown in the hover preview. */
  lastReadChapterTitle?: string;
}

import type { BookDTO, ContinueReadingItem } from "@rezics/contract";
import type { BookshelfItem } from "@/bookshelf-view";
import { getBookAuthorName } from "@/shared/utils/translation-helpers";

export interface BookProgressHint {
  chaptersCompleted: number;
  chaptersTotal: number;
  lastReadChapterTitle?: string;
}

/**
 * Index the dashboard's continue-reading items by book unit id so library
 * cards can show the server-aggregated `chaptersCompleted/chaptersTotal`
 * counter without re-fetching per-book TOC/node-completion rows.
 */
export function progressByBook(
  items: readonly ContinueReadingItem[],
): Map<string, BookProgressHint> {
  const map = new Map<string, BookProgressHint>();
  for (const item of items) {
    map.set(item.bookUnitId, {
      chaptersCompleted: item.chaptersCompleted,
      chaptersTotal: item.chaptersTotal,
      lastReadChapterTitle: item.lastReadNodeTitle ?? undefined,
    });
  }
  return map;
}

/**
 * Map a hydrated book to a bookshelf grid item, attaching the chapter counter
 * only when the book has countable chapters (so cards omit "0/0").
 */
export function bookToBookshelfItem(
  book: BookDTO,
  progress?: BookProgressHint,
): BookshelfItem {
  const item: BookshelfItem = {
    unitId: book.unitId,
    kind: "book",
    title: book.title ?? book.unitId,
    coverUrl: book.coverUrl ?? "",
    author: getBookAuthorName(book) || undefined,
    isLicensed: book.isLicensed,
    href: `/book/${book.unitId}`,
  };
  if (progress && progress.chaptersTotal > 0) {
    item.chaptersCompleted = progress.chaptersCompleted;
    item.chaptersTotal = progress.chaptersTotal;
    item.lastReadChapterTitle = progress.lastReadChapterTitle;
  }
  return item;
}

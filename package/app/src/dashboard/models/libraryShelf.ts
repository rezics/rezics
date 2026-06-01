import type {
  BookDTO,
  ContinueReadingItem,
  LibraryKind,
  ProgressLibraryRow,
  UnitType,
} from "@rezics/contract";
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
    title: book.translations?.[0]?.title ?? book.unitId,
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

function libraryKindFromUnitType(unitType: UnitType): LibraryKind | null {
  if (unitType === "BOOK") return "book";
  if (unitType === "GAME") return "game";
  if (unitType === "MEDIA") return "media";
  return null;
}

export function progressLibraryRowToBookshelfItem(
  row: ProgressLibraryRow,
): BookshelfItem | null {
  const kind = libraryKindFromUnitType(row.progressUnit.unitType);
  if (!kind) return null;

  const item: BookshelfItem = {
    unitId: row.progressUnit.unitId,
    kind,
    title: row.progressUnit.title || row.progressUnit.unitId,
    coverUrl: row.progressUnit.coverUrl ?? "",
    href:
      row.resumeRoute?.kind === "node"
        ? `/book/${row.resumeRoute.bookId}/node/${row.resumeRoute.nodeId}`
        : kind === "book"
          ? `/book/${row.progressUnit.unitId}`
          : `/unit/${row.progressUnit.unitId}`,
    isLicensed: true,
  };
  if (kind === "book" && row.progress.completedCount > 0) {
    item.chaptersCompleted = row.progress.completedCount;
  }
  return item;
}

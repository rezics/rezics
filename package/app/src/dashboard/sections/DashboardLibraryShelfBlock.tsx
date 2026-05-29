import { shelfUnitsQuery, useHydratedShelfUnits } from "@rezics/api/shelf";
import type {
  BookDTO,
  BookshelfViewConfig,
  ShelfSummaryDTO,
} from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { applyReadableFilter, BookshelfGrid } from "@/bookshelf-view";
import type { BookshelfItem } from "@/bookshelf-view";
import { Link } from "@/shared/ui/link";
import {
  type BookProgressHint,
  bookToBookshelfItem,
} from "../models/libraryShelf";

const LIBRARY_PAGE_LIMIT = 24;

export interface DashboardLibraryShelfBlockProps {
  shelf: ShelfSummaryDTO;
  config: BookshelfViewConfig;
  /** When true (the dashboard default), unlicensed books are hidden. */
  readableOnly: boolean;
  /** Chapter-completion counters keyed by book unit id. */
  progress: Map<string, BookProgressHint>;
}

/**
 * Renders one of the user's shelves as a bookshelf-view block on the
 * dashboard. Only the hydrated `book` library kind is shown (its `isLicensed`
 * drives the readable filter); the shelf collapses to nothing when no readable
 * book remains.
 */
export function DashboardLibraryShelfBlock({
  shelf,
  config,
  readableOnly,
  progress,
}: DashboardLibraryShelfBlockProps) {
  const { data } = useQuery(
    shelfUnitsQuery(shelf.unitId, { limit: LIBRARY_PAGE_LIMIT }),
  );
  const units = useMemo(() => data?.units ?? [], [data?.units]);
  const { enriched } = useHydratedShelfUnits(units);

  const items = useMemo(() => {
    const books: BookshelfItem[] = [];
    for (const entry of enriched) {
      if (entry.unit.kind !== "book") continue;
      const book = entry.data as BookDTO | undefined;
      if (!book) continue;
      books.push(bookToBookshelfItem(book, progress.get(book.unitId)));
    }
    return applyReadableFilter(books, readableOnly);
  }, [enriched, progress, readableOnly]);

  if (items.length === 0) return null;

  const shelfHref = `/shelf/${shelf.unitId}`;

  return (
    <div className="flex flex-col gap-2">
      <Link
        to={shelfHref}
        className="text-sm font-semibold text-text-primary hover:underline"
      >
        {shelf.title ?? shelf.unitId}
      </Link>
      <BookshelfGrid items={items} config={config} />
    </div>
  );
}

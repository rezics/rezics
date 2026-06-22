import { bookQueries } from "@rezics/api/book/book";
import { shelfInfiniteListQuery } from "@rezics/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  resolveCatalogEntryInteractionContext,
  shelfListFiltersForCatalogEntry,
} from "@/book-library";
import { QueryErrorDisplay } from "@/core";
import { LoadMoreFooter } from "@/shared/ui/LoadMoreFooter";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { ShelfCard } from "../components/ShelfCard";

interface ShelfByBookPageProps {
  bookId: string;
}

/**
 * Shelves containing a specific book page.
 *
 * Displays all shelves that contain the given book. Uses catalog entry context
 * to refine shelf filters. Supports infinite scroll pagination.
 *
 * 显示包含特定书籍的所有书架。使用目录条目上下文来优化书架过滤。
 * 支持无限滚动分页。
 *
 * Desktop (1200px):
 * +---------------------------------------------+
 * | Shelves Containing This Book                |
 * +---------------------------------------------+
 * | [Shelf 1]      [Shelf 2]    [Shelf 3]       |
 * | Cover          Cover         Cover          |
 * | Title 1        Title 2       Title 3        |
 * | 12 items       8 items      15 items        |
 * |                                             |
 * | [Shelf 4]      [Shelf 5]    [Shelf 6]       |
 * | [Load More]                                 |
 * +---------------------------------------------+
 *
 * Tablet (768px):
 * +---------------------------------+
 * | Shelves Containing Book         |
 * +---------------------------------+
 * | [Shelf 1]      [Shelf 2]       |
 * | Cover          Cover           |
 * | Title 1        Title 2         |
 * | 12 items       8 items         |
 * |                                 |
 * | [Shelf 3]      [Shelf 4]       |
 * | [Load More]                    |
 * +---------------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | Shelves  |
 * | in Book  |
 * +----------+
 * | [Shelf]  |
 * | Cover    |
 * | Title 1  |
 * | 12 items |
 * |          |
 * | [Shelf]  |
 * | Cover    |
 * | [More]   |
 * +----------+
 *
 * Empty State:
 * +----------+
 * | No       |
 * | shelves  |
 * +----------+
 */
export function ShelfByBookPage({ bookId }: ShelfByBookPageProps) {
  const { t } = useTranslation(["common", "entity"]);
  const readContext = useReadLanguageContext();
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: Boolean(bookId) && readContext.ready,
  });
  const catalogContext = bookInfo
    ? resolveCatalogEntryInteractionContext(bookInfo)
    : null;
  const shelfFilters = catalogContext
    ? shelfListFiltersForCatalogEntry(catalogContext, { limit: 50 })
    : { containsUnitId: bookId, limit: 50 };
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery(shelfInfiniteListQuery(shelfFilters));

  const shelves = data?.pages.flatMap((page) => page.shelves) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:shelf_containing_this_book_title")}
      </h1>

      {isError ? (
        // Shelf-by-book query failed — show error instead of empty state
        // 按书查询书架失败 —— 显示错误而非空状态
        <QueryErrorDisplay error={error} />
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {t("entity:shelf_none_for_this_book")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {shelves.map((shelf) => (
              <ShelfCard key={shelf.unitId} shelf={shelf} />
            ))}
          </div>
          <LoadMoreFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            className="mt-6"
          />
        </>
      )}
    </div>
  );
}

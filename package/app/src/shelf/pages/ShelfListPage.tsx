import { shelfInfiniteListQuery } from "@rezics/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { QueryErrorDisplay } from "@/core";
import { ShelfCard } from "../components/ShelfCard";

/**
 * Shelf list page.
 *
 * Main shelf browse page displaying all shelves sorted by creation date (newest first).
 * Provides navigation to shelf search and shelf creation. Supports infinite scroll.
 *
 * 书架列表页面。显示按创建日期（最新优先）排序的所有书架的主浏览页。
 * 提供导航到书架搜索和创建新书架的功能。支持无限滚动。
 *
 * Desktop (1200px):
 * +---------------------------------------------+
 * | All Shelves              [Search] [+ Create] |
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
 * | All Shelves [Search][+ Create]  |
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
 * | [Search] |
 * | [Create] |
 * +----------+
 * | [Shelf]  |
 * | Cover    |
 * | Title 1  |
 * | 12 items |
 * |          |
 * | [Shelf]  |
 * | [More]   |
 * +----------+
 *
 * Error State:
 * +----------+
 * | Error    |
 * | Try again|
 * +----------+
 */
export function ShelfListPage() {
  const { t } = useTranslation(["common", "entity"]);
  const navigate = useNavigate();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery(
    shelfInfiniteListQuery({
      sort: { field: "createdAt", order: "desc" },
      limit: 20,
    }),
  );

  const shelves = data?.pages.flatMap((page) => page.shelves) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t("entity:shelf_list_title")}
        </h1>
        <div className="flex flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/shelf/search" })}
          >
            {t("common:search")}
          </Button>
          <Button onClick={() => navigate({ to: "/shelf/new" })}>
            {t("entity:shelf_new_title")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <QueryErrorDisplay error={error} />
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {t("entity:shelf_empty_yet")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {shelves.map((shelf) => (
              <ShelfCard key={shelf.unitId} shelf={shelf} />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="ghost"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage
                  ? t("common:loading")
                  : t("common:load_more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

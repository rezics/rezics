import { shelfInfiniteListQuery } from "@rezics/api/shelf";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ShelfCard } from "../components/ShelfCard";
import { useMessage } from "@rezics/i18n/react";
import {
  common_load_more,
  common_loading,
  common_search,
  shelf_empty_yet,
  shelf_list_title,
  shelf_new_title,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_load_more,
  common_loading,
  common_search,
  shelf_empty_yet,
  shelf_list_title,
  shelf_new_title,
};

export function ShelfListPage() {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(
      shelfInfiniteListQuery({
        sort: { field: "createdAt", order: "desc" },
        limit: 20,
      }),
    );

  const shelves = data?.pages.flatMap((page) => page.shelves) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-semibold">{m.shelf_list_title()}</h1>
        <div className="flex flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/shelf/search" })}
          >
            {m.common_search()}
          </Button>
          <Button onClick={() => navigate({ to: "/shelf/new" })}>
            {m.shelf_new_title()}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {m.shelf_empty_yet()}
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
                {isFetchingNextPage ? m.common_loading() : m.common_load_more()}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ShelfListPage;

import { bookQueries } from "@rezics/api/book/book";
import { shelfInfiniteListQuery } from "@rezics/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  resolveCatalogEntryInteractionContext,
  shelfListFiltersForCatalogEntry,
} from "@/book-library/models/catalogEntryContext";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { ShelfCard } from "../components/ShelfCard";

interface ShelfByBookPageProps {
  bookId: string;
}

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
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery(shelfInfiniteListQuery(shelfFilters));

  const shelves = data?.pages.flatMap((page) => page.shelves) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:shelf_containing_this_book_title")}
      </h1>

      {isLoading ? (
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

export default ShelfByBookPage;

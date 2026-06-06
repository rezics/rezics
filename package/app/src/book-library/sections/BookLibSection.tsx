import type { BookDTO } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import type React from "react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import type { BookLibSortKey } from "@/search/components/SearchFilter";
import type { UseSearchQueryReturn } from "@/search/hooks/useSearchQuery";
import { BookListView } from "../components/BookList/BookListView";
import { BookSearch } from "../components/BookSearch/BookSearch";

/** Props for BookLibSection component. */
export type BookLibSectionProps = {
  /** List of books to display. */
  books: BookDTO[];
  /** Total number of items for pagination. */
  totalItems: number;
  /** Loading state indicator. */
  isLoading: boolean;
  /** Error object if fetch failed. */
  error: Error | null;
  /** Current sort configuration. */
  sortConfig: {
    type: BookLibSortKey;
    order: "asc" | "desc";
  };
  /** Callback when more data is needed for pagination. */
  handleNeedMoreData: (page: number) => void;
  /** Callback to pre-fetch data for next page. */
  handlePreRequestData: (page: number) => Promise<number | undefined>;
  /** Callback when sort changes. */
  handleSortChange: (newSort: {
    type?: string;
    order?: "asc" | "desc";
  }) => void;
  /** Number of items per external page fetch. */
  EXTERNAL_PAGE_SIZE: number;
  /** Shared search hook instance hosted by the page. */
  search: UseSearchQueryReturn;
  /** Callback to trigger a new search (apply current query). */
  onSearchSubmit: () => void;
};

/**
 * Book Library Section - Main content area for book list page.
 *
 * Displays a paginated, searchable list of books with sorting controls.
 * This is a section-level component composed by BookLibPage.
 */
export const BookLibSection = (
  {
    books,
    totalItems,
    isLoading,
    error,
    sortConfig,
    handleNeedMoreData,
    handlePreRequestData,
    handleSortChange,
    EXTERNAL_PAGE_SIZE,
    search,
    onSearchSubmit,
  }: BookLibSectionProps,
  ref: React.Ref<UniversalPaginatorHandle>,
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const universalPaginatorRef = useRef<UniversalPaginatorHandle>(null);

  useImperativeHandle(ref, () => ({
    resetPaginationPageNumber() {
      universalPaginatorRef.current?.resetPaginationPageNumber();
    },
  }));

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-4">
        <BookSearch
          query={search.query}
          bind={search.bind}
          patch={search.patch}
          implicit={search.implicit}
          middleware={search.middleware}
          onSubmit={onSearchSubmit}
        />
        <QueryErrorDisplay error={error} className="my-4" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <UniversalPaginator<BookDTO>
        ref={universalPaginatorRef}
        data={books}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={sortConfig.type}
        sortOrder={sortConfig.order}
        onSortChange={handleSortChange}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && books.length === 0}
        sortControl={
          <BookSearch
            query={search.query}
            bind={search.bind}
            patch={search.patch}
            implicit={search.implicit}
            middleware={search.middleware}
            onSubmit={onSearchSubmit}
          />
        }
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      >
        {(currentPageItems: BookDTO[]) => (
          <BookListView books={currentPageItems} />
        )}
      </UniversalPaginator>
    </div>
  );
};

/** BookLibSection with forwardRef for imperative handle access. */
export const BookLibSectionRef = forwardRef(BookLibSection);

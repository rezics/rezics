import { Alert } from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import type React from "react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { SearchInfo } from "@/search";
import type { BookLibSortKey } from "@/search/component/SearchFilter";
import { BookListView } from "../component/BookList/BookListView";
import { BookSearchInput } from "../component/BookSearch/BookSearch";

/** Props for BookLibSection component. */
export type BookLibSectionProps = {
  /** List of books to display. */
  books: BookDTO[];
  /** Total number of items for pagination. */
  totalItems: number;
  /** Loading state indicator. */
  isLoading: boolean;
  /** Error object if fetch failed. */
  error: unknown;
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
  /** Setter for search query state. */
  setCurrentQuery: React.Dispatch<React.SetStateAction<SearchInfo>>;
  /** Current search query. */
  currentQuery: SearchInfo;
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
    setCurrentQuery,
    currentQuery,
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
        <BookSearchInput onSearch={() => {}} />
        <Alert severity="error" className="my-4">
          {String(error)}
        </Alert>
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
          <BookSearchInput
            onSearch={(info) => {
              setCurrentQuery({
                keyword: info.keyword ?? "",
                tags: info.tags ?? [],
                nsfw: info.nsfw ?? false,
                isLicensed: info.isLicensed ?? undefined,
                textLength: info.textLength ?? "",
              });
            }}
            defaultValue={currentQuery}
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

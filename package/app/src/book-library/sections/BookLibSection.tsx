import type { BookDTO } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import type React from "react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { QueryErrorDisplay } from "@/core";
import type { BookLibSortKey, UseSearchQueryReturn } from "@/search";
import { BookListView } from "../components/BookList/BookListView";
import { BookSearch } from "../components/BookSearch/BookSearch";

export type BookLibSectionProps = {
  books: BookDTO[];
  /**
   * Total number of items for pagination.
   * 用于分页的总条目数。
   */
  totalItems: number;
  isLoading: boolean;
  /**
   * Error object if fetch failed.
   * 获取失败时的错误对象。
   */
  error: Error | null;
  sortConfig: {
    type: BookLibSortKey;
    order: "asc" | "desc";
  };
  /**
   * Callback when more data is needed for pagination.
   * 分页需要更多数据时的回调。
   */
  handleNeedMoreData: (page: number) => void;
  /**
   * Callback to pre-fetch data for next page.
   * 预取下一页数据的回调。
   */
  handlePreRequestData: (page: number) => Promise<number | undefined>;
  /**
   * Callback when sort changes.
   * 排序变化时的回调。
   */
  handleSortChange: (newSort: {
    type?: string;
    order?: "asc" | "desc";
  }) => void;
  /**
   * Number of items per external page fetch.
   * 每次外部分页获取的条目数。
   */
  EXTERNAL_PAGE_SIZE: number;
  /**
   * Shared search hook instance hosted by the page.
   * 由页面托管的共享 search hook 实例。
   */
  search: UseSearchQueryReturn;
  /**
   * Callback to trigger a new search (apply current query).
   * 触发新搜索（应用当前查询）的回调。
   */
  onSearchSubmit: () => void;
};

/**
 * Book Library Section - Main content area for book list page.
 * Book Library Section —— 图书列表页的主内容区。
 *
 * Displays a paginated, searchable list of books with sorting controls.
 * This is a section-level component composed by BookLibPage.
 * 展示带排序控件、可分页、可搜索的图书列表。
 * 这是由 BookLibPage 组合的 section 级组件。
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

/**
 * BookLibSection with forwardRef for imperative handle access.
 * 通过 forwardRef 暴露命令式 handle 访问的 BookLibSection。
 */
export const BookLibSectionRef = forwardRef(BookLibSection);

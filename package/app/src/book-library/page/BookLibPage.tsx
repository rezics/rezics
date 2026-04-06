import { meiliQueries } from "@rezics/api/meili/meili.queries";
import type { BookDTO } from "@rezics/contract";
import type { UniversalPaginatorHandle } from "@rezics/ui/composite/pagination/Pagination.tsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchInfo } from "@/search";
import type { BookLibSortKey } from "@/search/component/SearchFilter";

import { BookLibSectionRef } from "../section/BookLibSection";

/**
 * Book Library Page - Route-level entry point for book list.
 *
 * Responsibilities:
 * - Manage search query state
 * - Fetch paginated book data from Meili
 * - Handle pagination and sorting
 * - Compose BookLibSection with data
 *
 * This is a thin assembly layer that delegates UI to BookLibSection.
 */
export const BookLibPage: React.FC = () => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const EXTERNAL_PAGE_SIZE = 100;
  const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
    keyword: "",
    tags: [],
    nsfw: false,
    isLicensed: undefined,
    textLength: "",
  });
  const [start, setStart] = useState<number>(0);

  const { data, isLoading, error } = useQuery(
    meiliQueries.booksSearch({
      start,
      limit: EXTERNAL_PAGE_SIZE,
      keyword: currentQuery.keyword ?? "",
      tags: currentQuery.tags ?? [],
      ...(currentQuery.nsfw ? { nsfw: true } : {}),
      ...(currentQuery.isLicensed ? { isLicensed: true } : {}),
      ...(currentQuery.textLength
        ? { textLength: currentQuery.textLength }
        : {}),
    }),
  );

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  const queryClient = useQueryClient();
  async function handlePreRequestData(page: number) {
    const fetchedData = await queryClient.fetchQuery(
      meiliQueries.booksSearch({
        start: (page - 1) * EXTERNAL_PAGE_SIZE,
        limit: EXTERNAL_PAGE_SIZE,
        keyword: currentQuery.keyword ?? "",
        tags: currentQuery.tags ?? [],
        ...(currentQuery.nsfw ? { nsfw: true } : {}),
        ...(currentQuery.textLength
          ? { textLength: currentQuery.textLength }
          : {}),
      }),
    );
    return fetchedData?.books?.length;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber();
  }, []);

  const books: BookDTO[] = useMemo(() => data?.books ?? [], [data]);
  const totalItems: number = data?.total ?? 0;

  const [sortConfig, setSortConfig] = useState<{
    type: BookLibSortKey;
    order: "asc" | "desc";
  }>({
    type: "time",
    order: "desc",
  });

  const handleSortChange = (newSort: {
    type?: string;
    order?: "asc" | "desc";
  }) =>
    setSortConfig((prev) => ({
      type: newSort.type as BookLibSortKey,
      order: newSort.order ?? prev.order,
    }));

  return (
    <BookLibSectionRef
      ref={ref}
      books={books}
      totalItems={totalItems}
      isLoading={isLoading}
      error={error}
      currentQuery={currentQuery}
      setCurrentQuery={setCurrentQuery}
      sortConfig={sortConfig}
      handleNeedMoreData={handleNeedMoreData}
      handlePreRequestData={handlePreRequestData}
      handleSortChange={handleSortChange}
      EXTERNAL_PAGE_SIZE={EXTERNAL_PAGE_SIZE}
    />
  );
};

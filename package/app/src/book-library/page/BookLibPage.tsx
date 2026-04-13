import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { ContentSearchDocument } from "@rezics/contract";
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
 * Uses the unified content search index filtered to BOOK type.
 */
export const BookLibPage: React.FC = () => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const EXTERNAL_PAGE_SIZE = 100;
  const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
    keyword: "",
    tags: [],
    nsfw: false,
    isLicensed: undefined,
  });
  const [start, setStart] = useState<number>(0);

  const { data, isLoading, error } = useQuery(
    contentSearchQueryOptions({
      keyword: currentQuery.keyword || undefined,
      type: "BOOK",
      nsfw: currentQuery.nsfw ?? false,
      isLicensed: currentQuery.isLicensed,
      offset: start,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  const queryClient = useQueryClient();
  async function handlePreRequestData(page: number) {
    const fetchedData = await queryClient.fetchQuery(
      contentSearchQueryOptions({
        keyword: currentQuery.keyword || undefined,
        type: "BOOK",
        nsfw: currentQuery.nsfw ?? false,
        isLicensed: currentQuery.isLicensed,
        offset: (page - 1) * EXTERNAL_PAGE_SIZE,
        limit: EXTERNAL_PAGE_SIZE,
      }),
    );
    return fetchedData?.items?.length;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber();
  }, []);

  // Map ContentSearchDocument to BookDTO-compatible shape for existing UI
  const books = useMemo(
    () =>
      (data?.items ?? []).map((item: ContentSearchDocument) => ({
        unitId: item.id,
        defaultLanguage: item.defaultLanguage,
        translations: item.translations ?? (item.titles[0]
          ? [{ unitId: item.id, language: item.defaultLanguage ?? 'zh-CN', title: item.titles[0], subtitle: null, summary: item.summaries[0] ?? null, description: item.descriptions[0] ?? null }]
          : []),
        coverUrl: item.coverUrl,
        creditNames: item.creditNames,
        type: item.type,
        nsfw: item.nsfw,
        isLicensed: item.isLicensed,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    [data],
  );
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

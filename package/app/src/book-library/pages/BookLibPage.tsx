import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import {
  type ContentSearchDocument,
  DEFAULT_LANGUAGE,
  type SearchQuery,
} from "@rezics/contract";
import type { UniversalPaginatorHandle } from "@rezics/ui/composite/pagination/Pagination.tsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BookLibSortKey } from "@/search/components/SearchFilter";
import { useInjectedTags } from "@/search/hooks/useInjectedTags";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { parseSearchString } from "@/search/models/searchQuery";
import { useAllowedRatings } from "@/user/hooks/useAllowedRatings";

import { BookLibSectionRef } from "../sections/BookLibSection";

/**
 * Book Library Page - Route-level entry point for book list.
 *
 * Uses the unified content search index filtered to BOOK type.
 */
export const BookLibPage: React.FC = () => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const EXTERNAL_PAGE_SIZE = 100;
  const injectedTags = useInjectedTags();
  const urlSearch = useSearch({ strict: false }) as {
    tags?: string;
    keyword?: string;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: seed is intentionally frozen at mount; subsequent URL/tag changes go through user patches.
  const initial = useMemo<SearchQuery>(() => {
    const urlSlugs = urlSearch.tags?.split(",").filter(Boolean) ?? [];
    const seededTags = injectedTags?.length
      ? injectedTags.map((t) => ({
          ...(t.slug ? { slug: t.slug } : {}),
          ...(t.unitId ? { unitId: t.unitId } : {}),
          ...(t.name ? { name: t.name } : {}),
        }))
      : urlSlugs.map((slug) => ({ slug }));
    return {
      keyword: urlSearch.keyword ?? undefined,
      tags: seededTags.length ? seededTags : undefined,
    };
  }, []);

  const { allowed } = useAllowedRatings();
  const implicitInitial = useMemo<SearchQuery>(
    () => ({ type: ["BOOK"], ratings: allowed }),
    [allowed],
  );

  const search = useSearchQuery({
    initial,
    implicitInitial,
    middleware: parseSearchString,
  });

  const [start, setStart] = useState<number>(0);
  const [searchOpts, setSearchOpts] = useState(() => search.toOptions());

  const onSearchSubmit = () => {
    setSearchOpts(search.toOptions());
    setStart(0);
    ref.current?.resetPaginationPageNumber();
  };

  const { data, isLoading, error } = useQuery(
    contentSearchQueryOptions({
      ...searchOpts,
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
        ...searchOpts,
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
        translations:
          item.translations ??
          (item.titles[0]
            ? [
                {
                  unitId: item.id,
                  language: item.defaultLanguage ?? DEFAULT_LANGUAGE,
                  title: item.titles[0],
                  subtitle: null,
                  summary: item.summaries[0] ?? null,
                  description: item.descriptions[0] ?? null,
                } as any,
              ]
            : []),
        coverUrl: item.coverUrl,
        creditNames: item.creditNames,
        type: item.type,
        rating: item.rating,
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
      search={search}
      onSearchSubmit={onSearchSubmit}
      sortConfig={sortConfig}
      handleNeedMoreData={handleNeedMoreData}
      handlePreRequestData={handlePreRequestData}
      handleSortChange={handleSortChange}
      EXTERNAL_PAGE_SIZE={EXTERNAL_PAGE_SIZE}
    />
  );
};

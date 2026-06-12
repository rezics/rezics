import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO, ShelfDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { mapContentSearchDocToShelfDTO } from "@/shelf";

export type SimpleQueryState<T> = {
  items: T[];
  total?: number;
  isLoading: boolean;
  error: unknown;
};

export function useHomeBooks(limit = 12): SimpleQueryState<BookDTO> {
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...bookQueries.list({
      start: 0,
      limit: Math.max(limit, 12),
      sort: { type: "createdAt", order: "desc" },
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
    }),
    enabled: readContext.ready,
  });

  const items = data?.books ?? [];
  const total: number | undefined = data?.total;

  return { items, total, isLoading, error };
}

// Shelves from content search - returns shelf-type content docs
// 来自内容搜索的书架 —— 返回 shelf 类型的内容文档
export function useHomeShelves(limit = 6): SimpleQueryState<ShelfDTO> {
  const { data, isLoading, error } = useLocalizedContentSearch({
    type: "SHELF",
    limit,
    sort: { field: "createdAt", order: "desc" },
  });

  const items = useMemo<ShelfDTO[]>(
    () => (data?.items ?? []).map(mapContentSearchDocToShelfDTO),
    [data],
  );

  const total: number | undefined = data?.total;

  return { items, total, isLoading, error };
}

// Excerpts are not in the content index (type QUOTE not indexed)
// 摘录不在内容索引中（QUOTE 类型未被索引）
// MOCK: returns empty results until an excerpt search mechanism is implemented
// MOCK：在实现摘录搜索机制之前返回空结果
export function useHomeExcerpts(
  _limit = 6,
): SimpleQueryState<import("@rezics/contract").UnitDTO> {
  const items = useMemo<import("@rezics/contract").UnitDTO[]>(() => [], []);
  return { items, total: 0, isLoading: false, error: null };
}

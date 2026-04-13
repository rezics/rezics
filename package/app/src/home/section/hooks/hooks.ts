import { meiliContentApi } from "@rezics/api/meili/meili.api";
import type {
  BookDTO,
  ContentSearchDocument,
  QuoteDTO,
  ShelfDTO,
} from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type SimpleQueryState<T> = {
  items: T[];
  total?: number;
  isLoading: boolean;
  error: unknown;
};

export function useHomeBooks(limit = 12): SimpleQueryState<BookDTO> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["home", "content", "books", { limit }],
    queryFn: () =>
      meiliContentApi.contentSearch({
        type: "BOOK",
        limit,
        sort: { field: "createdAt", order: "desc" },
      }),
    staleTime: 1000 * 60,
  });

  const items = useMemo<BookDTO[]>(() => {
    return ((data?.items ?? []) as ContentSearchDocument[]).map((doc) => ({
      unitId: doc.id,
      defaultLanguage: doc.defaultLanguage,
      translations: doc.translations ?? (doc.titles[0]
        ? [{ unitId: doc.id, language: doc.defaultLanguage ?? 'zh-CN', title: doc.titles[0], subtitle: null, summary: doc.summaries[0] ?? null, description: doc.descriptions[0] ?? null }]
        : []),
      coverUrl: doc.coverUrl,
      nsfw: doc.nsfw,
      isLicensed: doc.isLicensed,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })) as BookDTO[];
  }, [data]);

  const total: number | undefined = data?.total;

  return { items, total, isLoading, error };
}

// Shelves from content search - returns shelf-type content docs
export function useHomeShelves(limit = 6): SimpleQueryState<ShelfDTO> {
  const { data, isLoading, error } = useQuery({
    queryKey: ["home", "content", "shelves", { limit }],
    queryFn: () =>
      meiliContentApi.contentSearch({
        type: "SHELF",
        limit,
        sort: { field: "createdAt", order: "desc" },
      }),
    staleTime: 1000 * 60,
  });

  const items = useMemo<ShelfDTO[]>(() => {
    return ((data?.items ?? []) as ContentSearchDocument[]).map((doc) => ({
      id: doc.id,
      title: doc.titles[0] ?? "",
      content: doc.descriptions[0] ?? "",
      translations: doc.translations ?? (doc.titles[0]
        ? [{ unitId: doc.id, language: doc.defaultLanguage ?? 'zh-CN', title: doc.titles[0], subtitle: null, summary: doc.summaries[0] ?? null, description: doc.descriptions[0] ?? null }]
        : []),
    })) as ShelfDTO[];
  }, [data]);

  const total: number | undefined = data?.total;

  return { items, total, isLoading, error };
}

type QuoteListResponse = {
  quotes: QuoteDTO[];
  total?: number;
};

// Quotes are not in the content index (type QUOTE not indexed)
// This returns empty results until a quote search mechanism is implemented
export function useHomeQuotes(limit = 6): SimpleQueryState<QuoteDTO> {
  const items = useMemo<QuoteDTO[]>(() => [], []);
  return { items, total: 0, isLoading: false, error: null };
}

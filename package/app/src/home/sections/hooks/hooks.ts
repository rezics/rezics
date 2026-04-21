import { useContentSearch } from "@rezics/api/meili/meili.queries";
import {
  type BookDTO,
  type ContentSearchDocument,
  DEFAULT_LANGUAGE,
  type ShelfDTO,
} from "@rezics/contract";
import { useMemo } from "react";

export type SimpleQueryState<T> = {
  items: T[];
  total?: number;
  isLoading: boolean;
  error: unknown;
};

export function useHomeBooks(limit = 12): SimpleQueryState<BookDTO> {
  const { data, isLoading, error } = useContentSearch({
    type: "BOOK",
    limit,
    sort: { field: "createdAt", order: "desc" },
  });

  const items = useMemo<BookDTO[]>(() => {
    return ((data?.items ?? []) as ContentSearchDocument[]).map((doc) => ({
      unitId: doc.id,
      defaultLanguage: doc.defaultLanguage,
      translations:
        doc.translations ??
        (doc.titles[0]
          ? [
              {
                unitId: doc.id,
                language: doc.defaultLanguage ?? DEFAULT_LANGUAGE,
                title: doc.titles[0],
                subtitle: null,
                summary: doc.summaries[0] ?? null,
                description: doc.descriptions[0] ?? null,
              },
            ]
          : []),
      coverUrl: doc.coverUrl,
      rating: doc.rating,
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
  const { data, isLoading, error } = useContentSearch({
    type: "SHELF",
    limit,
    sort: { field: "createdAt", order: "desc" },
  });

  const items = useMemo<ShelfDTO[]>(() => {
    return ((data?.items ?? []) as ContentSearchDocument[]).map((doc) => ({
      id: doc.id,
      title: doc.titles[0] ?? "",
      content: doc.descriptions[0] ?? "",
      translations:
        doc.translations ??
        (doc.titles[0]
          ? [
              {
                unitId: doc.id,
                language: doc.defaultLanguage ?? DEFAULT_LANGUAGE,
                title: doc.titles[0],
                subtitle: null,
                summary: doc.summaries[0] ?? null,
                description: doc.descriptions[0] ?? null,
              },
            ]
          : []),
    })) as unknown as ShelfDTO[];
  }, [data]);

  const total: number | undefined = data?.total;

  return { items, total, isLoading, error };
}

// Excerpts are not in the content index (type QUOTE not indexed)
// MOCK: returns empty results until an excerpt search mechanism is implemented
export function useHomeExcerpts(
  _limit = 6,
): SimpleQueryState<import("@rezics/contract").UnitDTO> {
  const items = useMemo<import("@rezics/contract").UnitDTO[]>(() => [], []);
  return { items, total: 0, isLoading: false, error: null };
}

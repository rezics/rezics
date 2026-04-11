/**
 * React Query configurations for Meilisearch content queries
 */

import type {
  ContentSearchOptions,
  ContentSearchResult,
  FeedbackListResponse,
  FeedbackType,
} from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { meiliContentApi, meiliFeedbackApi } from "./meili.api";

// ANCHOR: Content search

export const contentSearchQueryOptions = (opts: ContentSearchOptions) =>
  queryOptions({
    queryKey: ["meili", "content", opts],
    queryFn: () => meiliContentApi.contentSearch(opts),
    staleTime: 1000 * 60 * 2,
  });

export function useContentSearch(opts: ContentSearchOptions) {
  return useQuery(contentSearchQueryOptions(opts));
}

// ANCHOR: Feedback search

type FeedbackExtraFilterOptions = {
  userId?: string;
  type?: FeedbackType;
  resolved?: boolean;
};

export const buildMeiliFeedbackQuery = (
  offset: number,
  limit: number,
  keyword: string,
  options?: FeedbackExtraFilterOptions,
) => {
  const filters = {
    offset,
    limit,
    q: keyword || undefined,
    ...(options?.userId ? { userId: options.userId } : {}),
    ...(options?.type ? { type: options.type } : {}),
    ...(typeof options?.resolved === "boolean"
      ? { resolved: options.resolved }
      : {}),
  } as const;

  return {
    queryKey: [
      "meili-feedbacks",
      offset,
      limit,
      keyword,
      options?.userId ?? null,
      options?.type ?? null,
      typeof options?.resolved === "boolean" ? options.resolved : null,
    ],
    queryFn: async (): Promise<FeedbackListResponse> => {
      const searchResult = await meiliFeedbackApi.feedbackSearch(filters);
      return {
        items: searchResult.feedbacks as any[],
        offset,
        totalItems: searchResult.total,
      };
    },
    staleTime: 1000 * 60 * 5,
  } as const;
};

// ANCHOR: Legacy stubs
// MOCK: These query builders are retained as stubs for consumers
// not yet migrated to the new content search or server-side APIs.
// The old `units` and `books` Meili indexes have been dropped.

/** @deprecated Use useContentSearch instead */
// MOCK: book search query stub — returns empty results
export const meiliBookSearchQuery = (_filters?: any) =>
  queryOptions({
    queryKey: ["meili", "books", _filters],
    queryFn: async () => ({ books: [], total: 0, processingTimeMs: 0, query: "" }),
    staleTime: 1000 * 60 * 2,
  });

/** @deprecated Use useContentSearch instead */
export const meiliQueries = {
  booksSearch: meiliBookSearchQuery,
};

/** @deprecated Units index removed. Migrate to server-side API. */
// MOCK: unit query builder stub — returns empty results
export const buildMeiliUnitQuery = ({
  kind,
  start,
  targetUnitId,
  keyword,
  limit,
  mapFn,
  options,
}: any) => ({
  queryKey: ["meili-units", kind, targetUnitId ?? null, start, limit, keyword, options?.userId ?? null],
  queryFn: async () => mapFn({ units: [], total: 0 }),
  enabled: options?.enabled ?? true,
  staleTime: 1000 * 60 * 5,
});

/** @deprecated Readlists replaced by shelves. */
// MOCK: readlist query builder stub — returns empty results
export const buildMeiliReadlistQuery = (
  _start: number,
  _limit: number,
  _keyword: string,
  _tags: string[],
  _options?: any,
) => ({
  queryKey: ["meili-readlists", _start, _limit, _keyword, _tags?.join(",")],
  queryFn: async () => ({ readlists: [], total: 0 }),
  staleTime: 1000 * 60 * 5,
});

/** @deprecated Use useContentSearch instead */
// MOCK: review query builder stub — returns empty results
export const buildMeiliReviewQuery = (
  _start: number,
  _limit: number,
  _options?: any,
) => buildMeiliUnitQuery({
  kind: "REVIEW",
  start: _start,
  targetUnitId: undefined,
  keyword: _options?.keyword || "",
  limit: _limit,
  mapFn: (resp: any) => ({ reviews: [], total: resp.total }),
  options: _options,
});

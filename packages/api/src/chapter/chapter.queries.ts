/**
 * React Query configurations for Chapter queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { chapterApi } from "./chapter.api";
import { chapterKeys } from "./chapter.keys";
import type { ChapterFilters } from "./chapter.types";

/**
 * Query options for listing chapters
 */
export const chapterListQuery = (filters?: ChapterFilters) =>
  queryOptions({
    queryKey: chapterKeys.list(filters),
    queryFn: () => chapterApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single chapter
 */
export const chapterDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: chapterKeys.detail(unitId),
    queryFn: () => chapterApi.get(unitId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Query options for searching chapters
 */
export const chapterSearchQuery = (query: string, filters?: ChapterFilters) =>
  queryOptions({
    queryKey: chapterKeys.search(query, filters),
    queryFn: () => chapterApi.search(query, filters),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting chapters by user
 */
export const chaptersByUserQuery = (userId: string, filters?: ChapterFilters) =>
  queryOptions({
    queryKey: chapterKeys.byUser(userId),
    queryFn: () => chapterApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting chapters by target unit (book/parent)
 */
export const chaptersByTargetUnitQuery = (
  targetUnitId: string,
  filters?: ChapterFilters,
) =>
  queryOptions({
    queryKey: chapterKeys.byTargetUnit(targetUnitId),
    queryFn: () => chapterApi.getByTargetUnitId(targetUnitId, filters),
    enabled: !!targetUnitId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Infinite query options for paginated chapter list
 * Uses offset-like start pagination
 */
export const chapterInfiniteListQuery = (
  filters?: Omit<ChapterFilters, "page">,
) =>
  infiniteQueryOptions({
    queryKey: chapterKeys.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      chapterApi.list({ ...filters, start: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const { items, total } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore =
        items.length === limit && allPages.length * limit < (total || 0);
      return hasMore ? lastPageParam + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Combined query options export
 */
export const chapterQueries = {
  list: chapterListQuery,
  detail: chapterDetailQuery,
  search: chapterSearchQuery,
  byUser: chaptersByUserQuery,
  byTarget: chaptersByTargetUnitQuery,
  infiniteList: chapterInfiniteListQuery,
};

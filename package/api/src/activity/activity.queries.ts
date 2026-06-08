import type { ActivityListQuery } from "@rezics/contract";
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { activityApi } from "./activity.api";
import { activityKeys } from "./activity.keys";

export const activityListQuery = (userId: string, query?: ActivityListQuery) =>
  queryOptions({
    queryKey: activityKeys.list(userId, query),
    queryFn: () => activityApi.list(userId, query),
    staleTime: 1000 * 30,
  });

/**
 * Cursor-paginated timeline; `before` watermark threads through pages.
 * 游标分页的时间线；`before` 水位线贯穿各页传递。
 */
export const activityInfiniteQuery = (userId: string, limit?: number) =>
  infiniteQueryOptions({
    queryKey: activityKeys.list(userId, { limit }),
    queryFn: ({ pageParam }) =>
      activityApi.list(userId, { before: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 1000 * 30,
  });

export function useActivityInfinite(
  userId: string,
  opts?: { limit?: number; enabled?: boolean },
) {
  return useInfiniteQuery({
    ...activityInfiniteQuery(userId, opts?.limit),
    enabled: opts?.enabled ?? true,
  });
}

export const activityQueries = {
  list: activityListQuery,
  infinite: activityInfiniteQuery,
};

/**
 * React Query configurations for Shelf queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { shelfApi } from "./shelf.api";
import { shelfKeys } from "./shelf.keys";
import type { ShelfFilters } from "./shelf.types";

/**
 * Query options for listing shelves
 */
export const shelfListQuery = (filters?: ShelfFilters) =>
  queryOptions({
    queryKey: shelfKeys.list(filters),
    queryFn: () => shelfApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single shelf
 */
export const shelfDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: shelfKeys.detail(unitId),
    queryFn: () => shelfApi.get(unitId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Query options for getting shelves by user
 */
export const shelvesByUserQuery = (userId: string, filters?: ShelfFilters) =>
  queryOptions({
    queryKey: shelfKeys.byUser(userId),
    queryFn: () => shelfApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Infinite query options for paginated shelf list
 */
export const shelfInfiniteListQuery = (
  filters?: Omit<ShelfFilters, "start">,
) =>
  infiniteQueryOptions({
    queryKey: shelfKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      shelfApi.list({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const { shelves } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore = shelves.length === limit;
      return hasMore ? lastPageParam + limit : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Combined query options export
 */
export const shelfQueries = {
  list: shelfListQuery,
  detail: shelfDetailQuery,
  byUser: shelvesByUserQuery,
  infiniteList: shelfInfiniteListQuery,
};

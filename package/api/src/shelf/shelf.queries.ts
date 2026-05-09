import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { collectionApi, shelfApi } from "./shelf.api";
import { collectionKeys, shelfKeys } from "./shelf.keys";
import type { ShelfFilters, ShelfItemsQuery } from "./shelf.types";

export const shelfListQuery = (filters?: ShelfFilters) =>
  queryOptions({
    queryKey: shelfKeys.list(filters),
    queryFn: () => shelfApi.list(filters),
    staleTime: 1000 * 60 * 5,
  });

export const shelfDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: shelfKeys.detail(unitId),
    queryFn: () => shelfApi.get(unitId),
    staleTime: 1000 * 60 * 10,
  });

export const shelvesByUserQuery = (userId: string, filters?: ShelfFilters) =>
  queryOptions({
    queryKey: shelfKeys.byUser(userId, filters),
    queryFn: () => shelfApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

export const userShelvesQuery = () =>
  queryOptions({
    queryKey: shelfKeys.mine(),
    queryFn: () => shelfApi.mine(),
    staleTime: 1000 * 60 * 2,
  });

export const shelfItemsQuery = (unitId: string, query?: ShelfItemsQuery) =>
  queryOptions({
    queryKey: shelfKeys.itemsPage(unitId, query),
    queryFn: () => shelfApi.listItems(unitId, query),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2,
  });

export const shelfInfiniteListQuery = (filters?: Omit<ShelfFilters, "start">) =>
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
    staleTime: 1000 * 60 * 5,
  });

export const collectionStatusQuery = (targetId: string) =>
  queryOptions({
    queryKey: collectionKeys.status(targetId),
    queryFn: () => collectionApi.status(targetId),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 1,
  });

export const shelfQueries = {
  list: shelfListQuery,
  detail: shelfDetailQuery,
  byUser: shelvesByUserQuery,
  mine: userShelvesQuery,
  items: shelfItemsQuery,
  infiniteList: shelfInfiniteListQuery,
};

export const collectionQueries = {
  status: collectionStatusQuery,
};

import {
  infiniteQueryOptions,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { shelfApi, shelfItemActionApi } from "./shelf.api";
import {
  normalizeShelfItemStatusIds,
  type ShelfContainmentFilters,
  type ShelfVariantFilters,
  shelfItemStatusKeys,
  shelfKeys,
} from "./shelf.keys";
import type { ShelfFilters, ShelfItemsQuery } from "./shelf.types";

const SHELF_ITEM_STATUS_BATCH_LIMIT = 100;

export const shelfListQuery = (filters?: ShelfFilters) =>
  queryOptions({
    queryKey: shelfKeys.list(filters),
    queryFn: () => shelfApi.list(filters),
    staleTime: 1000 * 60 * 5,
  });

export const shelvesContainingUnitQuery = (
  unitId: string,
  filters?: ShelfContainmentFilters,
) =>
  queryOptions({
    queryKey: shelfKeys.containingUnit(unitId, filters),
    queryFn: () => shelfApi.list({ ...filters, containsUnitId: unitId }),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

export const shelvesByVariantContextQuery = (
  variantUnitId: string,
  filters?: ShelfVariantFilters,
) =>
  queryOptions({
    queryKey: shelfKeys.variantContext(variantUnitId, filters),
    queryFn: () => shelfApi.list({ ...filters, variantUnitId }),
    enabled: !!variantUnitId,
    staleTime: 1000 * 60 * 5,
  });

export const shelfDetailQuery = (
  unitId: string,
  filters?: Pick<ShelfFilters, "languages" | "appLocale">,
) =>
  queryOptions({
    queryKey: filters
      ? ([...shelfKeys.detail(unitId), filters] as const)
      : shelfKeys.detail(unitId),
    queryFn: () => shelfApi.get(unitId, filters),
    staleTime: 1000 * 60 * 10,
  });

export const shelvesByUserQuery = (userId: string, filters?: ShelfFilters) =>
  queryOptions({
    queryKey: shelfKeys.byUser(userId, filters),
    queryFn: () => shelfApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

export const userShelvesQuery = (filters?: ShelfFilters) =>
  queryOptions({
    queryKey: shelfKeys.mine(filters),
    queryFn: () => shelfApi.mine(filters),
    staleTime: 1000 * 60 * 2,
  });

export const userShelvesInfiniteQuery = (
  filters?: Omit<ShelfFilters, "start">,
) =>
  infiniteQueryOptions({
    queryKey: shelfKeys.mine(filters),
    queryFn: ({ pageParam = 0 }) =>
      shelfApi.mine({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const { shelves } = lastPage;
      const limit = filters?.limit || 50;
      const hasMore = shelves.length === limit;
      return hasMore ? lastPageParam + limit : undefined;
    },
    staleTime: 1000 * 60 * 2,
  });

export const shelfItemsQuery = (unitId: string, query?: ShelfItemsQuery) =>
  queryOptions({
    queryKey: shelfKeys.itemsPage(unitId, query),
    queryFn: () => shelfApi.listItems(unitId, query),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2,
  });

export const shelfItemsInfiniteQuery = (
  unitId: string,
  query?: Omit<ShelfItemsQuery, "cursor">,
) =>
  infiniteQueryOptions({
    queryKey: shelfKeys.itemsPage(unitId, query),
    queryFn: ({ pageParam }) =>
      shelfApi.listItems(unitId, { ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.items.at(-1)?.itemId;
    },
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

export const shelfItemStatusQuery = (targetId: string) =>
  queryOptions({
    queryKey: shelfItemStatusKeys.status(targetId),
    queryFn: () => shelfItemActionApi.status(targetId),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 1,
  });

export const shelfItemStatusBatchQuery = (targetIds: readonly string[]) => {
  const normalized = normalizeShelfItemStatusIds(targetIds).slice(
    0,
    SHELF_ITEM_STATUS_BATCH_LIMIT,
  );
  return queryOptions({
    queryKey: shelfItemStatusKeys.statusBatch(normalized),
    queryFn: () => shelfItemActionApi.statusBatch(normalized),
    enabled: normalized.length > 0,
    staleTime: 1000 * 60 * 1,
  });
};

export function useShelfItemStatusHydration(
  targetIds: readonly string[],
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const normalized = normalizeShelfItemStatusIds(targetIds).slice(
    0,
    SHELF_ITEM_STATUS_BATCH_LIMIT,
  );
  const query = useQuery({
    ...shelfItemStatusBatchQuery(normalized),
    enabled: (options?.enabled ?? true) && normalized.length > 0,
  });

  useEffect(() => {
    if (!query.data) return;
    for (const [targetId, status] of Object.entries(
      query.data.statusesByTarget,
    )) {
      queryClient.setQueryData(shelfItemStatusKeys.status(targetId), status);
    }
  }, [query.data, queryClient]);

  return query;
}

export const shelfQueries = {
  list: shelfListQuery,
  containingUnit: shelvesContainingUnitQuery,
  variantContext: shelvesByVariantContextQuery,
  detail: shelfDetailQuery,
  byUser: shelvesByUserQuery,
  mine: userShelvesQuery,
  infiniteMine: userShelvesInfiniteQuery,
  items: shelfItemsQuery,
  infiniteItems: shelfItemsInfiniteQuery,
  infiniteList: shelfInfiniteListQuery,
};

export const shelfItemStatusQueries = {
  status: shelfItemStatusQuery,
  statusBatch: shelfItemStatusBatchQuery,
};

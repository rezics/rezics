import {
  infiniteQueryOptions,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { collectionApi, shelfApi } from "./shelf.api";
import {
  collectionKeys,
  normalizeCollectionIds,
  shelfKeys,
} from "./shelf.keys";
import type { ShelfFilters, ShelfUnitsQuery } from "./shelf.types";

const COLLECTION_STATUS_BATCH_LIMIT = 100;

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

export const shelfUnitsQuery = (unitId: string, query?: ShelfUnitsQuery) =>
  queryOptions({
    queryKey: shelfKeys.unitsPage(unitId, query),
    queryFn: () => shelfApi.listUnits(unitId, query),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2,
  });

export const shelfUnitsInfiniteQuery = (
  unitId: string,
  query?: Omit<ShelfUnitsQuery, "cursor">,
) =>
  infiniteQueryOptions({
    queryKey: shelfKeys.unitsPage(unitId, query),
    queryFn: ({ pageParam }) =>
      shelfApi.listUnits(unitId, { ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.units.at(-1)?.unitId;
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

export const collectionStatusQuery = (targetId: string) =>
  queryOptions({
    queryKey: collectionKeys.status(targetId),
    queryFn: () => collectionApi.status(targetId),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 1,
  });

export const collectionStatusBatchQuery = (targetIds: readonly string[]) => {
  const normalized = normalizeCollectionIds(targetIds).slice(
    0,
    COLLECTION_STATUS_BATCH_LIMIT,
  );
  return queryOptions({
    queryKey: collectionKeys.statusBatch(normalized),
    queryFn: () => collectionApi.statusBatch(normalized),
    enabled: normalized.length > 0,
    staleTime: 1000 * 60 * 1,
  });
};

export function useCollectionStatusHydration(
  targetIds: readonly string[],
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const normalized = normalizeCollectionIds(targetIds).slice(
    0,
    COLLECTION_STATUS_BATCH_LIMIT,
  );
  const query = useQuery({
    ...collectionStatusBatchQuery(normalized),
    enabled: (options?.enabled ?? true) && normalized.length > 0,
  });

  useEffect(() => {
    if (!query.data) return;
    for (const [targetId, status] of Object.entries(
      query.data.statusesByTarget,
    )) {
      queryClient.setQueryData(collectionKeys.status(targetId), status);
    }
  }, [query.data, queryClient]);

  return query;
}

export const shelfQueries = {
  list: shelfListQuery,
  detail: shelfDetailQuery,
  byUser: shelvesByUserQuery,
  mine: userShelvesQuery,
  units: shelfUnitsQuery,
  infiniteUnits: shelfUnitsInfiniteQuery,
  infiniteList: shelfInfiniteListQuery,
};

export const collectionQueries = {
  status: collectionStatusQuery,
  statusBatch: collectionStatusBatchQuery,
};

/**
 * React Query configurations for Realm queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { realmApi } from "./realm.api";
import { realmKeys } from "./realm.keys";
import type { RealmFilters } from "./realm.types";

/**
 * Query options for listing realms
 */
export const realmListQuery = (filters?: RealmFilters) =>
  queryOptions({
    queryKey: realmKeys.list(filters),
    queryFn: () => realmApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single realm
 */
export const realmDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: realmKeys.detail(unitId),
    queryFn: () => realmApi.get(unitId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Query options for searching realms
 */
export const realmSearchQuery = (query: string, filters?: RealmFilters) =>
  queryOptions({
    queryKey: realmKeys.search(query, filters),
    queryFn: () => realmApi.search(query, filters),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting realm members
 */
export const realmMembersQuery = (realmUnitId: string) =>
  queryOptions({
    queryKey: realmKeys.members(realmUnitId),
    queryFn: () => realmApi.getMembers(realmUnitId),
    enabled: !!realmUnitId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting realm units (content)
 */
export const realmUnitsQuery = (realmUnitId: string) =>
  queryOptions({
    queryKey: realmKeys.units(realmUnitId),
    queryFn: () => realmApi.getUnits(realmUnitId),
    enabled: !!realmUnitId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting realm tag-unit associations
 */
export const realmTagUnitsQuery = (realmUnitId: string) =>
  queryOptions({
    queryKey: realmKeys.tagUnits(realmUnitId),
    queryFn: () => realmApi.getTagUnits(realmUnitId),
    enabled: !!realmUnitId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Infinite query options for paginated realm list
 */
export const realmInfiniteListQuery = (
  filters?: Omit<RealmFilters, "start">,
) =>
  infiniteQueryOptions({
    queryKey: realmKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      realmApi.list({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const { realms } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore = realms.length === limit;
      return hasMore ? lastPageParam + limit : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Combined query options export
 */
export const realmQueries = {
  list: realmListQuery,
  detail: realmDetailQuery,
  search: realmSearchQuery,
  members: realmMembersQuery,
  units: realmUnitsQuery,
  tagUnits: realmTagUnitsQuery,
  infiniteList: realmInfiniteListQuery,
};

/**
 * React Query configurations for Unit queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { UnitLanguageContentQuery } from "@rezics/contract";
import { unitApi } from "./unit.api";
import { unitKeys } from "./unit.keys";
import type { UnitFilters } from "./unit.types";

/**
 * Query options for listing units
 */
export const unitListQuery = (filters?: UnitFilters) =>
  queryOptions({
    queryKey: unitKeys.list(filters),
    queryFn: () => unitApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for searching units
 */
export const unitSearchQuery = (query: string, filters?: UnitFilters) =>
  queryOptions({
    queryKey: unitKeys.search(query, filters),
    queryFn: () => unitApi.search(query, filters),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting units by user
 */
export const unitsByUserQuery = (userId: string, filters?: UnitFilters) =>
  queryOptions({
    queryKey: unitKeys.byUser(userId),
    queryFn: () => unitApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single unit
 */
export const unitDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: unitKeys.detail(unitId),
    queryFn: () => unitApi.get(unitId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

export const unitLanguagesQuery = (unitId: string) =>
  queryOptions({
    queryKey: unitKeys.languages(unitId),
    queryFn: () => unitApi.languages(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 10,
  });

export const unitLanguageContentQuery = (
  unitId: string,
  query?: UnitLanguageContentQuery,
) =>
  queryOptions({
    queryKey: unitKeys.languageContent(unitId, query),
    queryFn: () => unitApi.languageContent(unitId, query),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

/**
 * Infinite query options for paginated unit list
 */
export const unitInfiniteListQuery = (filters?: Omit<UnitFilters, "start">) =>
  infiniteQueryOptions({
    queryKey: unitKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      unitApi.list({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const { units, total } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore = units.length === limit;
      return hasMore ? lastPageParam + limit : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for looking up a unit by slug
 */
export const unitBySlugQuery = (unitSlug: string) =>
  queryOptions({
    queryKey: unitKeys.bySlug(unitSlug),
    queryFn: () => unitApi.getBySlug(unitSlug),
    enabled: !!unitSlug,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Combined query options export
 */
export const unitQueries = {
  list: unitListQuery,
  detail: unitDetailQuery,
  languages: unitLanguagesQuery,
  languageContent: unitLanguageContentQuery,
  bySlug: unitBySlugQuery,
  search: unitSearchQuery,
  byUser: unitsByUserQuery,
  infiniteList: unitInfiniteListQuery,
};

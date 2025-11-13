/**
 * React Query configurations for Unit queries
 */

import {queryOptions, infiniteQueryOptions} from '@tanstack/react-query';
import {unitApi} from './unit.api';
import {unitKeys} from './unit.keys';
import type {UnitFilters} from './unit.types';

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

/**
 * Infinite query options for paginated unit list
 * @todo Align with backend pagination (offset/cursor)
 */
export const unitInfiniteListQuery = (filters?: Omit<UnitFilters, 'page'>) =>
  infiniteQueryOptions({
    queryKey: unitKeys.list(filters),
    queryFn: ({pageParam = 1}) => unitApi.list({...filters, start: pageParam}),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const {units, total} = lastPage;
      const limit = filters?.limit || 20;
      const hasMore =
        units.length === limit && allPages.length * limit < (total || 0);
      return hasMore ? lastPageParam + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Combined query options export
 */
export const unitQueries = {
  list: unitListQuery,
  detail: unitDetailQuery,
  search: unitSearchQuery,
  byUser: unitsByUserQuery,
  infiniteList: unitInfiniteListQuery,
};

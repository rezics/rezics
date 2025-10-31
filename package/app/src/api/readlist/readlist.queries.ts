/**
 * React Query configurations for Readlist queries
 */

import {queryOptions, infiniteQueryOptions} from '@tanstack/react-query';
import {readlistApi} from './readlist.api';
import {readlistKeys} from './readlist.keys';
import type {ReadlistFilters} from './readlist.types';

/**
 * Query options for listing readlists
 */
export const readlistListQuery = (filters?: ReadlistFilters) =>
  queryOptions({
    queryKey: readlistKeys.list(filters),
    queryFn: () => readlistApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single readlist
 */
export const readlistDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: readlistKeys.detail(unitId),
    queryFn: () => readlistApi.get(unitId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Query options for searching readlists
 */
export const readlistSearchQuery = (query: string, filters?: ReadlistFilters) =>
  queryOptions({
    queryKey: readlistKeys.search(query, filters),
    queryFn: () => readlistApi.search(query, filters),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting readlists by user
 */
export const readlistsByUserQuery = (
  userId: string,
  filters?: ReadlistFilters,
) =>
  queryOptions({
    queryKey: readlistKeys.byUser(userId),
    queryFn: () => readlistApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Infinite query options for paginated readlist list
 * Uses offset-like start pagination (same as books)
 */
export const readlistInfiniteListQuery = (
  filters?: Omit<ReadlistFilters, 'page'>,
) =>
  infiniteQueryOptions({
    queryKey: readlistKeys.list(filters),
    queryFn: ({pageParam = 1}) =>
      readlistApi.list({...filters, start: pageParam}),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const {readlists, total} = lastPage;
      const limit = filters?.limit || 20;
      const hasMore =
        readlists.length === limit && allPages.length * limit < (total || 0);
      return hasMore ? lastPageParam + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Combined query options export
 */
export const readlistQueries = {
  list: readlistListQuery,
  detail: readlistDetailQuery,
  search: readlistSearchQuery,
  byUser: readlistsByUserQuery,
  infiniteList: readlistInfiniteListQuery,
};

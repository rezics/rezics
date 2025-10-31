/**
 * React Query configurations for Review queries
 */

import {queryOptions, infiniteQueryOptions} from '@tanstack/react-query';
import {reviewApi} from './review.api';
import {reviewKeys} from './review.keys';
import type {ReviewFilters} from './review.types';

/**
 * Query options for listing reviews
 */
export const reviewListQuery = (filters?: ReviewFilters) =>
  queryOptions({
    queryKey: reviewKeys.list(filters),
    queryFn: () => reviewApi.list(filters),
    staleTime: 1000 * 60 * 5,
  });

/**
 * Query options for getting a single review
 */
export const reviewDetailQuery = (id: string) =>
  queryOptions({
    queryKey: reviewKeys.detail(id),
    queryFn: () => reviewApi.get(id),
    staleTime: 1000 * 60 * 10,
  });

/**
 * Query options for searching reviews
 */
export const reviewSearchQuery = (query: string, filters?: ReviewFilters) =>
  queryOptions({
    queryKey: reviewKeys.search(query, filters),
    queryFn: () => reviewApi.search(query, filters),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2,
  });

/**
 * Query options for getting reviews by user
 */
export const reviewsByUserQuery = (userId: string, filters?: ReviewFilters) =>
  queryOptions({
    queryKey: reviewKeys.byUser(userId),
    queryFn: () => reviewApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

/**
 * Query options for getting reviews by book
 */
export const reviewsByBookQuery = (bookId: string, filters?: ReviewFilters) =>
  queryOptions({
    queryKey: reviewKeys.byBook(bookId),
    queryFn: () => reviewApi.getByBookId(bookId, filters),
    enabled: !!bookId,
    staleTime: 1000 * 60 * 5,
  });

/**
 * Infinite query options for paginated review list
 */
export const reviewInfiniteListQuery = (
  filters?: Omit<ReviewFilters, 'page'>,
) =>
  infiniteQueryOptions({
    queryKey: reviewKeys.list(filters),
    queryFn: ({pageParam = 1}) =>
      reviewApi.list({...filters, start: pageParam}),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const {reviews, total} = lastPage;
      const limit = filters?.limit || 20;
      const hasMore =
        reviews.length === limit && allPages.length * limit < (total || 0);
      return hasMore ? lastPageParam + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

/**
 * Combined query options export
 */
export const reviewQueries = {
  list: reviewListQuery,
  detail: reviewDetailQuery,
  search: reviewSearchQuery,
  byUser: reviewsByUserQuery,
  byBook: reviewsByBookQuery,
  infiniteList: reviewInfiniteListQuery,
};

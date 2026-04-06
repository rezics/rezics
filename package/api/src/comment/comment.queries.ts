/**
 * React Query configurations for Comment queries
 */

import type { CommentTreeQuery } from "@rezics/contract";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { commentApi } from "./comment.api";
import { commentKeys } from "./comment.keys";
import type { CommentListFilters } from "./comment.types";

/**
 * Query options for listing a slice of comments.
 * Enabled only when a valid rootUnitId is provided.
 */
export const commentListQuery = (filters: CommentListFilters) =>
  queryOptions({
    queryKey: commentKeys.list(filters),
    queryFn: () => commentApi.list(filters),
    enabled: !!filters.rootUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for fetching a single comment by unit id.
 */
export const commentDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: commentKeys.detail(unitId),
    queryFn: () => commentApi.get(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Infinite query options for paginated comment list.
 * Uses `start` as page index; relies on returned item length vs limit.
 * Stops when fewer than requested limit items are returned.
 */
export const commentInfiniteListQuery = (
  filters: Omit<CommentListFilters, "start">,
) =>
  infiniteQueryOptions({
    queryKey: commentKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      commentApi.list({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const limit = filters.limit || 20;
      const count = lastPage.items.length;
      return count === limit ? lastPageParam + limit : undefined;
    },
    enabled: !!filters.rootUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting a comment tree slice under a unit
 */
export const unitCommentTreeQuery = (
  unitId: string,
  params?: CommentTreeQuery,
) =>
  queryOptions({
    queryKey: commentKeys.commentTree(unitId, params),
    queryFn: () => commentApi.getCommentTree(unitId, params),
    staleTime: 1000 * 60 * 2, // 2 minutes - comments change frequently
  });

/**
 * Combined comment query exports
 */
export const commentQueries = {
  list: commentListQuery,
  detail: commentDetailQuery,
  infiniteList: commentInfiniteListQuery,
  unitCommentTree: unitCommentTreeQuery,
};

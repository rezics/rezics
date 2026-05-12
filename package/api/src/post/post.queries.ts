/**
 * React Query configurations for Post queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { postApi } from "./post.api";
import { type PostByTargetFilters, postKeys } from "./post.keys";
import type { PostFilters } from "./post.types";

/**
 * Query options for listing posts
 */
export const postListQuery = (filters?: PostFilters) =>
  queryOptions({
    queryKey: postKeys.list(filters),
    queryFn: () => postApi.list(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes - posts change frequently
  });

/**
 * Query options for getting a single post
 */
export const postDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: postKeys.detail(unitId),
    queryFn: () => postApi.get(unitId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting posts for a target unit
 */
export const postsByTargetQuery = (
  targetUnitId: string,
  filters?: PostByTargetFilters,
) =>
  queryOptions({
    queryKey: postKeys.byTarget(targetUnitId, filters),
    queryFn: () => postApi.getByTarget(targetUnitId, filters),
    enabled: !!targetUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting posts by author
 */
export const postsByAuthorQuery = (
  authorUserId: string,
  filters?: PostFilters,
) =>
  queryOptions({
    queryKey: postKeys.byAuthor(authorUserId, filters),
    queryFn: () => postApi.getByAuthor(authorUserId, filters),
    enabled: !!authorUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a thread (all replies under root post)
 */
export const postThreadQuery = (
  rootPostUnitId: string,
  filters?: PostFilters,
) =>
  queryOptions({
    queryKey: postKeys.thread(rootPostUnitId, filters),
    queryFn: () => postApi.getThread(rootPostUnitId, filters),
    enabled: !!rootPostUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting a descendant subtree under a post.
 */
export const postSubtreeQuery = (
  rootPostUnitId: string,
  subtreeRootPostUnitId: string,
  filters?: PostFilters,
) =>
  queryOptions({
    queryKey: postKeys.subtree(rootPostUnitId, subtreeRootPostUnitId, filters),
    queryFn: () =>
      postApi.getSubtree(rootPostUnitId, subtreeRootPostUnitId, filters),
    enabled: !!rootPostUnitId && !!subtreeRootPostUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting direct replies to a post
 */
export const postRepliesQuery = (
  parentPostUnitId: string,
  filters?: PostFilters,
) =>
  queryOptions({
    queryKey: postKeys.replies(parentPostUnitId, filters),
    queryFn: () => postApi.getReplies(parentPostUnitId, filters),
    enabled: !!parentPostUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting posts within a realm
 */
export const postsByRealmQuery = (realmUnitId: string, filters?: PostFilters) =>
  queryOptions({
    queryKey: postKeys.byRealm(realmUnitId, filters),
    queryFn: () => postApi.getByRealm(realmUnitId, filters),
    enabled: !!realmUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Infinite query options for paginated post list
 */
export const postInfiniteListQuery = (filters?: Omit<PostFilters, "start">) =>
  infiniteQueryOptions({
    queryKey: postKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      postApi.list({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const { posts } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore = posts.length === limit;
      return hasMore ? lastPageParam + limit : undefined;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Combined query options export
 */
export const postQueries = {
  list: postListQuery,
  detail: postDetailQuery,
  byTarget: postsByTargetQuery,
  byAuthor: postsByAuthorQuery,
  thread: postThreadQuery,
  subtree: postSubtreeQuery,
  replies: postRepliesQuery,
  byRealm: postsByRealmQuery,
  infiniteList: postInfiniteListQuery,
};

/**
 * React Query configurations for Post queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { postApi } from "./post.api";
import {
  type PostByTargetFilters,
  type PostByVariantFilters,
  postKeys,
} from "./post.keys";
import type { PostFilters } from "./post.types";

type PostReadQuery = {
  explicitLanguage?: string;
  languages?: string | readonly string[];
  appLocale?: string;
};

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
export const postDetailQuery = (unitId: string, query?: PostReadQuery) =>
  queryOptions({
    queryKey: postKeys.detail(unitId, query),
    queryFn: () => postApi.get(unitId, query),
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

export const postsByVariantQuery = (
  variantUnitId: string,
  filters?: PostByVariantFilters,
) =>
  queryOptions({
    queryKey: postKeys.byVariant(variantUnitId, filters),
    queryFn: () => postApi.getByVariant(variantUnitId, filters),
    enabled: !!variantUnitId,
    staleTime: 1000 * 60 * 2,
  });

export const wikiPostsByTargetQuery = (
  targetUnitId: string,
  filters?: PostByTargetFilters,
) =>
  queryOptions({
    queryKey: postKeys.wikiByTarget(targetUnitId, filters),
    queryFn: () => postApi.getWikiByTarget(targetUnitId, filters),
    enabled: !!targetUnitId,
    staleTime: 1000 * 60 * 2,
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
 * Query options for getting posts within a realm
 */
export const postsByRealmQuery = (realmUnitId: string, filters?: PostFilters) =>
  queryOptions({
    queryKey: postKeys.byRealm(realmUnitId, filters),
    queryFn: () => postApi.getByRealm(realmUnitId, filters),
    enabled: !!realmUnitId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

export const wikiPostsByRealmQuery = (
  realmUnitId: string,
  filters?: Omit<PostFilters, "kind" | "realmUnitId">,
) =>
  queryOptions({
    queryKey: postKeys.wikiByRealm(realmUnitId, filters),
    queryFn: () => postApi.getWikiByRealm(realmUnitId, filters),
    enabled: !!realmUnitId,
    staleTime: 1000 * 60 * 2,
  });

export const postModerationOverlaysQuery = (
  targetUnitIds: string[],
  realmUnitId?: string | null,
) =>
  queryOptions({
    queryKey: postKeys.moderationOverlays(realmUnitId, targetUnitIds),
    queryFn: () =>
      postApi.getModerationOverlays({ realmUnitId, targetUnitIds }),
    enabled: targetUnitIds.length > 0,
    staleTime: 1000 * 30,
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
  byVariant: postsByVariantQuery,
  wikiByTarget: wikiPostsByTargetQuery,
  byAuthor: postsByAuthorQuery,
  byRealm: postsByRealmQuery,
  wikiByRealm: wikiPostsByRealmQuery,
  moderationOverlays: postModerationOverlaysQuery,
  infiniteList: postInfiniteListQuery,
};

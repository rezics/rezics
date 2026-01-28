/**
 * React Query configurations for Reaction queries
 */

import {queryOptions} from '@tanstack/react-query';
import {reactionApi} from './reaction.api';
import {reactionKeys} from './reaction.keys';
import type {
  ReactionListQuery,
  BookmarkTagsResponse,
} from './reaction.types.ts';

/**
 * Query options for listing reactions
 */
export const reactionListQuery = (filters?: ReactionListQuery) =>
  queryOptions({
    queryKey: reactionKeys.list(filters),
    queryFn: () => reactionApi.list(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting summary by target
 */
export const reactionSummaryQuery = (targetId: string) =>
  queryOptions({
    queryKey: reactionKeys.summary(targetId),
    queryFn: () => reactionApi.summary(targetId),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting current user's reactions for a target
 */
export const reactionMyQuery = (targetId: string) =>
  queryOptions({
    queryKey: reactionKeys.my(targetId),
    queryFn: () => reactionApi.my({targetId}),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 1, // 1 minute
  });

/**
 * Query options for getting current user's bookmark tags on a target
 */
export const reactionBookmarkTagsQuery = (targetId: string) =>
  queryOptions({
    queryKey: reactionKeys.bookmarkTags(targetId),
    queryFn: () => reactionApi.getBookmarkTags(targetId),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Combined query options export
 */
export const reactionQueries = {
  list: reactionListQuery,
  summary: reactionSummaryQuery,
  my: reactionMyQuery,
  bookmarkTags: reactionBookmarkTagsQuery,
};

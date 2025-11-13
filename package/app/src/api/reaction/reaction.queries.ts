/**
 * React Query configurations for Reaction queries
 */

import {queryOptions} from '@tanstack/react-query';
import {reactionApi} from './reaction.api';
import {reactionKeys} from './reaction.keys';
import type {ReactionListQuery} from './reaction.types.ts';

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
export const reactionSummaryQuery = (targetType: string, targetId: string) =>
  queryOptions({
    queryKey: reactionKeys.summary(targetType, targetId),
    queryFn: () => reactionApi.summary(targetType, targetId),
    enabled: !!targetType && !!targetId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting current user's reactions for a target
 */
export const reactionMyQuery = (targetType: string, targetId: string) =>
  queryOptions({
    queryKey: reactionKeys.my(targetType, targetId),
    queryFn: () => reactionApi.my(targetType, targetId),
    enabled: !!targetType && !!targetId,
    staleTime: 1000 * 60 * 1, // 1 minute
  });

/**
 * Combined query options export
 */
export const reactionQueries = {
  list: reactionListQuery,
  summary: reactionSummaryQuery,
  my: reactionMyQuery,
};

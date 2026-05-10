/**
 * React Query configurations for Reaction queries
 */

import { queryOptions, useQuery } from "@tanstack/react-query";
import { reactionApi } from "./reaction.api";
import { normalizeIds, reactionKeys } from "./reaction.keys";
import type {
  ReactionMyResponse,
  ReactionSummaryResponse,
} from "./reaction.types";

/**
 * Query options for getting summary by target
 */
export const reactionSummaryQuery = (targetId: string) =>
  queryOptions({
    queryKey: reactionKeys.summary(targetId),
    queryFn: () => reactionApi.summary([targetId]),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 2,
  });

/**
 * Query options for getting current user's reactions for a target
 */
export const reactionMyQuery = (targetId: string) =>
  queryOptions({
    queryKey: reactionKeys.my(targetId),
    queryFn: () => reactionApi.my([targetId]),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 1,
  });

/**
 * Query options for fetching a batch of reaction summaries in one request.
 * Normalizes `targetIds` (sort + dedupe) for stable cache keys.
 */
export const batchReactionSummaryQuery = (targetIds: readonly string[]) => {
  const normalized = normalizeIds(targetIds);
  return queryOptions({
    queryKey: reactionKeys.summaryBatch(normalized),
    queryFn: () => reactionApi.summary(normalized),
    enabled: normalized.length > 0,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Hook wrapper around the batch reaction summary query.
 */
export const useBatchReactionSummary = (
  targetIds: readonly string[],
  options?: { enabled?: boolean },
) => {
  const normalized = normalizeIds(targetIds);
  const enabled = (options?.enabled ?? true) && normalized.length > 0;
  return useQuery<ReactionSummaryResponse>({
    queryKey: reactionKeys.summaryBatch(normalized),
    queryFn: () => reactionApi.summary(normalized),
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Query options for fetching the current user's reactions for a batch of targets.
 * Normalises `targetIds` (sort + dedupe) for stable cache keys.
 */
export const batchUserReactionsQuery = (targetIds: readonly string[]) => {
  const normalized = normalizeIds(targetIds);
  return queryOptions({
    queryKey: reactionKeys.myBatch(normalized),
    queryFn: () => reactionApi.my(normalized),
    enabled: normalized.length > 0,
    staleTime: 1000 * 60 * 1,
  });
};

/**
 * Hook wrapper around the batch user-reactions query.
 *
 * Caller passes `enabled` (typically derived from auth state) — when not
 * authenticated this MUST be false so logged-out users do not generate 401
 * traffic. The hook is otherwise auto-disabled when no IDs are supplied.
 */
export const useBatchUserReactions = (
  targetIds: readonly string[],
  options?: { enabled?: boolean },
) => {
  const normalized = normalizeIds(targetIds);
  const enabled = (options?.enabled ?? true) && normalized.length > 0;
  return useQuery<ReactionMyResponse>({
    queryKey: reactionKeys.myBatch(normalized),
    queryFn: () => reactionApi.my(normalized),
    enabled,
    staleTime: 1000 * 60 * 1,
  });
};

export const reactionQueries = {
  summary: reactionSummaryQuery,
  my: reactionMyQuery,
  summaryBatch: batchReactionSummaryQuery,
  myBatch: batchUserReactionsQuery,
};

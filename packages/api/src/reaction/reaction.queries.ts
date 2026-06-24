/**
 * React Query configurations for Reaction queries
 */

import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { reactionApi } from "./reaction.api";
import { normalizeIds, reactionKeys } from "./reaction.keys";
import type {
  ReactionHistoryGivenItem,
  ReactionHistoryPage,
  ReactionHistoryReceivedItem,
  ReactionMyResponse,
  ReactionSummaryResponse,
  ShareSummaryResponse,
} from "./reaction.types";

/**
 * Query options for getting summary by target
 */
export const reactionSummaryQuery = (
  targetId: string,
  contextUnitId: string | null = null,
) =>
  queryOptions({
    queryKey: reactionKeys.summary(targetId, contextUnitId),
    queryFn: () => reactionApi.summary([targetId], { contextUnitId }),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 2,
  });

/**
 * Query options for getting current user's reactions for a target
 */
export const reactionMyQuery = (
  targetId: string,
  contextUnitId: string | null = null,
) =>
  queryOptions({
    queryKey: reactionKeys.my(targetId, contextUnitId),
    queryFn: () => reactionApi.my([targetId], { contextUnitId }),
    enabled: !!targetId,
    staleTime: 1000 * 60 * 1,
  });

/**
 * Query options for fetching a batch of reaction summaries in one request.
 * Normalizes `targetIds` (sort + dedupe) for stable cache keys.
 */
export const batchReactionSummaryQuery = (
  targetIds: readonly string[],
  contextUnitId: string | null = null,
) => {
  const normalized = normalizeIds(targetIds);
  return queryOptions({
    queryKey: reactionKeys.summaryBatch(normalized, contextUnitId),
    queryFn: () => reactionApi.summary(normalized, { contextUnitId }),
    enabled: normalized.length > 0,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Hook wrapper around the batch reaction summary query.
 */
export const useBatchReactionSummary = (
  targetIds: readonly string[],
  options?: { enabled?: boolean; contextUnitId?: string | null },
) => {
  const normalized = normalizeIds(targetIds);
  const enabled = (options?.enabled ?? true) && normalized.length > 0;
  return useQuery<ReactionSummaryResponse>({
    queryKey: reactionKeys.summaryBatch(
      normalized,
      options?.contextUnitId ?? null,
    ),
    queryFn: () =>
      reactionApi.summary(normalized, {
        contextUnitId: options?.contextUnitId ?? null,
      }),
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};

export const batchShareSummaryQuery = (targetIds: readonly string[]) => {
  const normalized = normalizeIds(targetIds);
  return queryOptions({
    queryKey: reactionKeys.shareSummaryBatch(normalized),
    queryFn: () => reactionApi.shareSummary(normalized),
    enabled: normalized.length > 0,
    staleTime: 1000 * 60 * 2,
  });
};

export const useBatchShareSummary = (
  targetIds: readonly string[],
  options?: { enabled?: boolean },
) => {
  const normalized = normalizeIds(targetIds);
  const enabled = (options?.enabled ?? true) && normalized.length > 0;
  return useQuery<ShareSummaryResponse>({
    queryKey: reactionKeys.shareSummaryBatch(normalized),
    queryFn: () => reactionApi.shareSummary(normalized),
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Query options for fetching the current user's reactions for a batch of targets.
 * Normalises `targetIds` (sort + dedupe) for stable cache keys.
 */
export const batchUserReactionsQuery = (
  targetIds: readonly string[],
  contextUnitId: string | null = null,
) => {
  const normalized = normalizeIds(targetIds);
  return queryOptions({
    queryKey: reactionKeys.myBatch(normalized, contextUnitId),
    queryFn: () => reactionApi.my(normalized, { contextUnitId }),
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
  options?: { enabled?: boolean; contextUnitId?: string | null },
) => {
  const normalized = normalizeIds(targetIds);
  const enabled = (options?.enabled ?? true) && normalized.length > 0;
  return useQuery<ReactionMyResponse>({
    queryKey: reactionKeys.myBatch(normalized, options?.contextUnitId ?? null),
    queryFn: () =>
      reactionApi.my(normalized, {
        contextUnitId: options?.contextUnitId ?? null,
      }),
    enabled,
    staleTime: 1000 * 60 * 1,
  });
};

/**
 * Infinite query: a profile's given reaction history.
 *
 * Pages are fetched cursor-style: each page response carries `nextCursor`,
 * which we feed back as `pageParam` until the server returns `null`.
 */
export const useGivenReactionsInfinite = (
  userId: string | undefined,
  options?: {
    reactions?: string;
    contextUnitId?: string | null;
    enabled?: boolean;
    limit?: number;
  },
) => {
  const enabled = (options?.enabled ?? true) && Boolean(userId);
  return useInfiniteQuery<
    ReactionHistoryPage<ReactionHistoryGivenItem>,
    Error,
    { pages: ReactionHistoryPage<ReactionHistoryGivenItem>[] },
    ReturnType<typeof reactionKeys.given>,
    string | undefined
  >({
    queryKey: reactionKeys.given(
      userId ?? "",
      options?.reactions,
      options?.contextUnitId,
    ),
    queryFn: ({ pageParam }) =>
      reactionApi.given(userId!, {
        reactions: options?.reactions,
        contextUnitId: options?.contextUnitId,
        cursor: pageParam,
        limit: options?.limit,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    staleTime: 1000 * 30,
  });
};

/**
 * Infinite query: a profile's received reaction history.
 */
export const useReceivedReactionsInfinite = (
  userId: string | undefined,
  options?: { reactions?: string; enabled?: boolean; limit?: number },
) => {
  const enabled = (options?.enabled ?? true) && Boolean(userId);
  return useInfiniteQuery<
    ReactionHistoryPage<ReactionHistoryReceivedItem>,
    Error,
    { pages: ReactionHistoryPage<ReactionHistoryReceivedItem>[] },
    ReturnType<typeof reactionKeys.received>,
    string | undefined
  >({
    queryKey: reactionKeys.received(userId ?? "", options?.reactions),
    queryFn: ({ pageParam }) =>
      reactionApi.received(userId!, {
        reactions: options?.reactions,
        cursor: pageParam,
        limit: options?.limit,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    staleTime: 1000 * 30,
  });
};

export const reactionQueries = {
  summary: reactionSummaryQuery,
  my: reactionMyQuery,
  summaryBatch: batchReactionSummaryQuery,
  shareSummaryBatch: batchShareSummaryQuery,
  myBatch: batchUserReactionsQuery,
};

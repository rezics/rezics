/**
 * React Query mutations for Reaction operations.
 *
 * Cache-update strategy: per-target optimistic update against every cached
 * `summaryBatch` and `myBatch` containing the affected `targetId`. Snapshot
 * is restored on error. `onSuccess` reconciles only the affected slice when
 * the server-reported value differs — never a page-wide invalidate.
 */

import {
  type QueryKey,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateForCacheDomain } from "../react-query/cache-coherence";
import { reactionApi } from "./reaction.api";
import { reactionKeys } from "./reaction.keys";
import type {
  ReactionCreateInput,
  ReactionDeleteQuery,
  ReactionDTO,
  ReactionMyResponse,
  ReactionSummaryResponse,
} from "./reaction.types";

type SummarySnapshot = { key: QueryKey; data: ReactionSummaryResponse };
type MySnapshot = { key: QueryKey; data: ReactionMyResponse };

type MutationContext = {
  summarySnapshots: SummarySnapshot[];
  mySnapshots: MySnapshot[];
};

function isBatchKey(key: QueryKey, prefix: readonly unknown[]): boolean {
  if (!Array.isArray(key)) return false;
  if (key.length !== prefix.length + 1) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (key[i] !== prefix[i]) return false;
  }
  return Array.isArray(key[key.length - 1]);
}

function batchContainsTarget(key: QueryKey, targetId: string): boolean {
  const ids = (key as unknown[])[key.length - 1];
  return Array.isArray(ids) && ids.includes(targetId);
}

function snapshotAffectedBatches(
  queryClient: ReturnType<typeof useQueryClient>,
  targetId: string,
): MutationContext {
  const summaryPrefix = [...reactionKeys.summaries(), "batch"] as const;
  const myPrefix = [...reactionKeys.mine(), "batch"] as const;

  const summarySnapshots: SummarySnapshot[] = [];
  for (const [key, data] of queryClient.getQueriesData<ReactionSummaryResponse>(
    { queryKey: reactionKeys.summaries() },
  )) {
    if (!isBatchKey(key, summaryPrefix)) continue;
    if (!batchContainsTarget(key, targetId)) continue;
    if (data === undefined) continue;
    summarySnapshots.push({ key, data });
  }

  const mySnapshots: MySnapshot[] = [];
  for (const [key, data] of queryClient.getQueriesData<ReactionMyResponse>({
    queryKey: reactionKeys.mine(),
  })) {
    if (!isBatchKey(key, myPrefix)) continue;
    if (!batchContainsTarget(key, targetId)) continue;
    if (data === undefined) continue;
    mySnapshots.push({ key, data });
  }

  return { summarySnapshots, mySnapshots };
}

function applySummaryDelta(
  data: ReactionSummaryResponse,
  targetId: string,
  reaction: string,
  delta: number,
): ReactionSummaryResponse {
  const targetSummary = { ...(data.summaries[targetId] ?? {}) };
  const next = (targetSummary[reaction] ?? 0) + delta;
  if (next <= 0) {
    delete targetSummary[reaction];
  } else {
    targetSummary[reaction] = next;
  }
  return {
    ...data,
    summaries: {
      ...data.summaries,
      [targetId]: targetSummary,
    },
  };
}

function applyUserReactionAdd(
  data: ReactionMyResponse,
  targetId: string,
  reaction: string,
): ReactionMyResponse {
  const current = data.reactionsByTarget[targetId] ?? [];
  if (current.includes(reaction)) return data;
  return {
    ...data,
    reactionsByTarget: {
      ...data.reactionsByTarget,
      [targetId]: [...current, reaction],
    },
  };
}

function applyUserReactionRemove(
  data: ReactionMyResponse,
  targetId: string,
  reaction: string,
): ReactionMyResponse {
  const current = data.reactionsByTarget[targetId];
  if (!current || !current.includes(reaction)) return data;
  return {
    ...data,
    reactionsByTarget: {
      ...data.reactionsByTarget,
      [targetId]: current.filter((r) => r !== reaction),
    },
  };
}

function restoreSnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  context: MutationContext | undefined,
) {
  if (!context) return;
  for (const snap of context.summarySnapshots) {
    queryClient.setQueryData(snap.key, snap.data);
  }
  for (const snap of context.mySnapshots) {
    queryClient.setQueryData(snap.key, snap.data);
  }
}

export function useCreateReactionMutation(
  options?: Omit<
    UseMutationOptions<
      ReactionDTO,
      Error,
      ReactionCreateInput,
      MutationContext
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<ReactionDTO, Error, ReactionCreateInput, MutationContext>({
    mutationFn: (input: ReactionCreateInput) => reactionApi.create(input),
    ...options,
    onMutate: async (variables, mutationCtx) => {
      const userOnMutate = await options?.onMutate?.(variables, mutationCtx);
      const context = snapshotAffectedBatches(queryClient, variables.targetId);

      for (const snap of context.summarySnapshots) {
        queryClient.setQueryData(
          snap.key,
          applySummaryDelta(
            snap.data,
            variables.targetId,
            variables.reaction,
            1,
          ),
        );
      }
      for (const snap of context.mySnapshots) {
        queryClient.setQueryData(
          snap.key,
          applyUserReactionAdd(
            snap.data,
            variables.targetId,
            variables.reaction,
          ),
        );
      }

      return userOnMutate ? { ...context, ...userOnMutate } : context;
    },
    onError: (error, variables, context, mutationCtx) => {
      restoreSnapshots(queryClient, context);
      options?.onError?.(error, variables, context, mutationCtx);
    },
    onSuccess: (data, variables, context, mutationCtx) => {
      // The optimistic delta already landed in every affected reaction batch
      // cache, so reaction summaries are not invalidated here. Cross-cutting
      // surfaces (detail/dashboard/profile/realm-feed/search) still refresh
      // through the coherence map so activity and counts stay consistent.
      void invalidateForCacheDomain(queryClient, "reaction");
      options?.onSuccess?.(data, variables, context, mutationCtx);
    },
  });
}

export function useDeleteReactionMutation(
  options?: Omit<
    UseMutationOptions<
      { deleted: boolean },
      Error,
      ReactionDeleteQuery,
      MutationContext
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    { deleted: boolean },
    Error,
    ReactionDeleteQuery,
    MutationContext
  >({
    mutationFn: (query: ReactionDeleteQuery) => reactionApi.remove(query),
    ...options,
    onMutate: async (variables, mutationCtx) => {
      const userOnMutate = await options?.onMutate?.(variables, mutationCtx);
      const context = snapshotAffectedBatches(queryClient, variables.targetId);

      for (const snap of context.summarySnapshots) {
        queryClient.setQueryData(
          snap.key,
          applySummaryDelta(
            snap.data,
            variables.targetId,
            variables.reaction,
            -1,
          ),
        );
      }
      for (const snap of context.mySnapshots) {
        queryClient.setQueryData(
          snap.key,
          applyUserReactionRemove(
            snap.data,
            variables.targetId,
            variables.reaction,
          ),
        );
      }

      return userOnMutate ? { ...context, ...userOnMutate } : context;
    },
    onError: (error, variables, context, mutationCtx) => {
      restoreSnapshots(queryClient, context);
      options?.onError?.(error, variables, context, mutationCtx);
    },
    onSuccess: (data, variables, context, mutationCtx) => {
      options?.onSuccess?.(data, variables, context, mutationCtx);
    },
  });
}

export const reactionMutations = {
  useCreate: useCreateReactionMutation,
  useDelete: useDeleteReactionMutation,
};

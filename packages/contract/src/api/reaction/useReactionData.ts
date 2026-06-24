/**
 * useReactionData — selector hook that reads the per-target reaction summary
 * and current user reactions for a single `targetId` from the React Query batch
 * caches populated by `useReactionHydration`.
 *
 * Strategy: scan the active `summaryBatch` / `myBatch` cache entries for the
 * one whose normalised id list contains `targetId`, and pick the largest such
 * batch (so a section that hydrated 30 ids supersedes a smaller overlapping
 * batch). The hook re-renders whenever any reaction query in the cache
 * changes — typical batch caches update at the same rate as the underlying
 * fetch / `setQueryData` call, so this is cheap.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { reactionKeys } from "./reaction.keys";
import type {
  ReactionMyResponse,
  ReactionSummaryResponse,
  ShareSummaryResponse,
} from "./reaction.types";

export type UseReactionDataReturn = {
  summary: Record<string, number>;
  shareCount: number;
  userReactions: string[];
  isHydrated: boolean;
};

export type UseReactionDataOptions = {
  summaryContextUnitId?: string | null;
  userContextUnitId?: string | null;
};

const EMPTY_SUMMARY: Record<string, number> = Object.freeze({});
const EMPTY_USER_REACTIONS = Object.freeze([] as string[]) as string[];

function readBatchEntries<T>(
  cacheEntries: ReadonlyArray<[readonly unknown[], T | undefined]>,
  prefix: ReadonlyArray<unknown>,
  contextUnitId?: string | null,
): Array<{ ids: readonly string[]; data: T }> {
  const matches: Array<{ ids: readonly string[]; data: T }> = [];
  for (const [key, data] of cacheEntries) {
    if (data === undefined) continue;
    if (key.length !== prefix.length + 1) continue;
    let prefixOk = true;
    for (let i = 0; i < prefix.length; i++) {
      if (key[i] !== prefix[i]) {
        prefixOk = false;
        break;
      }
    }
    if (!prefixOk) continue;
    const tail = key[key.length - 1];
    if (!Array.isArray(tail) && (!tail || typeof tail !== "object")) continue;
    const objectTail = tail as {
      targetIds?: unknown;
      contextUnitId?: string | null;
    };
    const ids = Array.isArray(tail) ? tail : objectTail.targetIds;
    if (!Array.isArray(ids)) continue;
    const entryScopeKey = Array.isArray(tail)
      ? null
      : (objectTail.contextUnitId ?? null);
    if (entryScopeKey !== (contextUnitId ?? null)) continue;
    matches.push({ ids, data });
  }
  return matches;
}

function pickLargestContaining<T>(
  matches: Array<{ ids: readonly string[]; data: T }>,
  targetId: string,
): T | undefined {
  let best: { ids: readonly string[]; data: T } | undefined;
  for (const match of matches) {
    if (!match.ids.includes(targetId)) continue;
    if (!best || match.ids.length > best.ids.length) {
      best = match;
    }
  }
  return best?.data;
}

export function useReactionData(
  targetId: string,
  options: UseReactionDataOptions = {},
): UseReactionDataReturn {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    return cache.subscribe((event) => {
      const key = event?.query?.queryKey as readonly unknown[] | undefined;
      if (!key || key[0] !== "reactions") return;
      if (event.type !== "updated") return;
      if (event.action.type !== "success" && event.action.type !== "setState") {
        return;
      }
      setVersion((v) => v + 1);
    });
  }, [queryClient]);

  return useMemo(() => {
    void version;
    if (!targetId) {
      return {
        summary: EMPTY_SUMMARY,
        shareCount: 0,
        userReactions: EMPTY_USER_REACTIONS,
        isHydrated: false,
      };
    }

    const summaryEntries = queryClient.getQueriesData<ReactionSummaryResponse>({
      queryKey: reactionKeys.summaries(),
    });
    const myEntries = queryClient.getQueriesData<ReactionMyResponse>({
      queryKey: reactionKeys.mine(),
    });
    const shareEntries = queryClient.getQueriesData<ShareSummaryResponse>({
      queryKey: reactionKeys.shareSummaries(),
    });

    const summaryPrefix = [...reactionKeys.summaries(), "batch"] as const;
    const myPrefix = [...reactionKeys.mine(), "batch"] as const;
    const sharePrefix = [...reactionKeys.shareSummaries(), "batch"] as const;

    const summaryBatches = readBatchEntries<ReactionSummaryResponse>(
      summaryEntries,
      summaryPrefix,
      options.summaryContextUnitId ?? null,
    );
    const myBatches = readBatchEntries<ReactionMyResponse>(
      myEntries,
      myPrefix,
      options.userContextUnitId ?? null,
    );
    const shareBatches = readBatchEntries<ShareSummaryResponse>(
      shareEntries,
      sharePrefix,
    );

    const summaryData = pickLargestContaining(summaryBatches, targetId);
    const myData = pickLargestContaining(myBatches, targetId);
    const shareData = pickLargestContaining(shareBatches, targetId);

    const summary = summaryData?.summaries?.[targetId] ?? EMPTY_SUMMARY;
    const shareCount = shareData?.summaries?.[targetId]?.shareCount ?? 0;
    const userReactions =
      myData?.reactionsByTarget?.[targetId] ?? EMPTY_USER_REACTIONS;

    const isHydrated = summaryData !== undefined;

    return { summary, shareCount, userReactions, isHydrated };
  }, [
    targetId,
    options.summaryContextUnitId,
    options.userContextUnitId,
    queryClient,
    version,
  ]);
}

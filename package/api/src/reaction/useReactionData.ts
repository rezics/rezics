/**
 * useReactionData — selector hook that reads the per-target reaction summary
 * and current user reactions for a single `unitId` from the React Query batch
 * caches populated by `useReactionHydration`.
 *
 * Strategy: scan the active `summaryBatch` / `myBatch` cache entries for the
 * one whose normalised id list contains `unitId`, and pick the largest such
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
} from "./reaction.types";

export type UseReactionDataReturn = {
  summary: Record<string, number>;
  userReactions: string[];
  isHydrated: boolean;
};

const EMPTY_SUMMARY: Record<string, number> = Object.freeze({});
const EMPTY_USER_REACTIONS = Object.freeze([] as string[]) as string[];

function readBatchEntries<T>(
  cacheEntries: ReadonlyArray<[readonly unknown[], T | undefined]>,
  prefix: ReadonlyArray<unknown>,
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
    const ids = key[key.length - 1];
    if (!Array.isArray(ids)) continue;
    matches.push({ ids: ids as readonly string[], data });
  }
  return matches;
}

function pickLargestContaining<T>(
  matches: Array<{ ids: readonly string[]; data: T }>,
  unitId: string,
): T | undefined {
  let best: { ids: readonly string[]; data: T } | undefined;
  for (const match of matches) {
    if (!match.ids.includes(unitId)) continue;
    if (!best || match.ids.length > best.ids.length) {
      best = match;
    }
  }
  return best?.data;
}

export function useReactionData(unitId: string): UseReactionDataReturn {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    return cache.subscribe((event) => {
      const key = event?.query?.queryKey as readonly unknown[] | undefined;
      if (!key || key[0] !== "reactions") return;
      setVersion((v) => v + 1);
    });
  }, [queryClient]);

  return useMemo(() => {
    void version;
    if (!unitId) {
      return {
        summary: EMPTY_SUMMARY,
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

    const summaryPrefix = [...reactionKeys.summaries(), "batch"] as const;
    const myPrefix = [...reactionKeys.mine(), "batch"] as const;

    const summaryBatches = readBatchEntries<ReactionSummaryResponse>(
      summaryEntries,
      summaryPrefix,
    );
    const myBatches = readBatchEntries<ReactionMyResponse>(myEntries, myPrefix);

    const summaryData = pickLargestContaining(summaryBatches, unitId);
    const myData = pickLargestContaining(myBatches, unitId);

    const summary = summaryData?.summaries?.[unitId] ?? EMPTY_SUMMARY;
    const userReactions =
      myData?.reactionsByTarget?.[unitId] ?? EMPTY_USER_REACTIONS;

    const isHydrated = summaryData !== undefined;

    return { summary, userReactions, isHydrated };
  }, [unitId, queryClient, version]);
}

/**
 * React Query configurations for Poll queries.
 */

import { queryOptions } from "@tanstack/react-query";
import { pollApi } from "./poll.api";
import { pollKeys } from "./poll.keys";

/**
 * Query options for reading a poll's results (poll + options + gated tallies).
 */
export const pollDetailQuery = (pollUnitId: string) =>
  queryOptions({
    queryKey: pollKeys.detail(pollUnitId),
    queryFn: () => pollApi.get(pollUnitId),
    enabled: !!pollUnitId,
    staleTime: 1000 * 30,
  });

export const pollQueries = {
  detail: pollDetailQuery,
};

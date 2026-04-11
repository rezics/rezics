/**
 * React Query configurations for Reaction queries
 */

import { queryOptions } from "@tanstack/react-query";
import { reactionApi } from "./reaction.api";
import { reactionKeys } from "./reaction.keys";

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

export const reactionQueries = {
  summary: reactionSummaryQuery,
  my: reactionMyQuery,
};

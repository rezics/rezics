import type { DraftListQuery } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { draftApi } from "./draft.api";
import { draftKeys } from "./draft.keys";

export const draftListQuery = (query?: DraftListQuery) =>
  queryOptions({
    queryKey: draftKeys.list(query),
    queryFn: () => draftApi.list(query),
    staleTime: 1000 * 30,
  });

export function useDrafts(query?: DraftListQuery) {
  return useQuery(draftListQuery(query));
}

export const draftQueries = {
  list: draftListQuery,
};

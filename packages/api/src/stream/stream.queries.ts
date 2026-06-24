import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { streamApi } from "./stream.api";
import { streamKeys } from "./stream.keys";
import type { StreamQuery } from "./stream.types";

export const streamRowsQuery = (query?: StreamQuery) =>
  queryOptions({
    queryKey: streamKeys.rows(query),
    queryFn: () => streamApi.rows(query),
    staleTime: 1000 * 60 * 2,
  });

export const streamRowsInfiniteQuery = (query?: Omit<StreamQuery, "cursor">) =>
  infiniteQueryOptions({
    queryKey: streamKeys.rows(query),
    queryFn: ({ pageParam }) =>
      streamApi.rows({
        ...query,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as StreamQuery["cursor"] | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 2,
  });

export const streamQueries = {
  rows: streamRowsQuery,
  infiniteRows: streamRowsInfiniteQuery,
};

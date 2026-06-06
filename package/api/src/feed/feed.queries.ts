import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { feedApi } from "./feed.api";
import { feedKeys } from "./feed.keys";
import type { FeedQuery } from "./feed.types";

export const feedRowsQuery = (query?: FeedQuery) =>
  queryOptions({
    queryKey: feedKeys.rows(query),
    queryFn: () => feedApi.rows(query),
    staleTime: 1000 * 60 * 2,
  });

export const feedRowsInfiniteQuery = (query?: Omit<FeedQuery, "cursor">) =>
  infiniteQueryOptions({
    queryKey: feedKeys.rows(query),
    queryFn: ({ pageParam }) =>
      feedApi.rows({
        ...query,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as FeedQuery["cursor"] | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 2,
  });

export const feedQueries = {
  rows: feedRowsQuery,
  infiniteRows: feedRowsInfiniteQuery,
};

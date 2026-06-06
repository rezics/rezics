import type { CommentListBody, CommentListQuery } from "@rezics/contract";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { commentApi } from "./comment.api";
import { commentKeys } from "./comment.keys";

export const commentQuery = (id: string) =>
  queryOptions({
    queryKey: commentKeys.detail(id),
    queryFn: () => commentApi.get(id),
    enabled: !!id,
  });

export const commentListQuery = (query: CommentListQuery) =>
  queryOptions({
    queryKey: commentKeys.list(query),
    queryFn: () => commentApi.list(query),
    enabled: !!query.rootUnitId,
  });

export const commentDiscoveryQuery = (query: Omit<CommentListQuery, "mode">) =>
  commentListQuery({ ...query, mode: "discovery" });

export const commentDiscoveryInfiniteQuery = (
  query: Omit<CommentListQuery, "mode" | "cursor">,
) =>
  infiniteQueryOptions({
    queryKey: commentKeys.list({ ...query, mode: "discovery" }),
    queryFn: ({ pageParam }) =>
      commentApi.list({
        ...query,
        mode: "discovery",
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as CommentListQuery["cursor"] | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const commentRootQuery = (
  query: Omit<CommentListQuery, "mode" | "parentCommentId"> & {
    rootCommentId: string;
  },
) => commentListQuery({ ...query, mode: "root" });

export const commentRootChildrenInfiniteQuery = (
  query: Omit<CommentListQuery, "mode" | "cursor" | "parentCommentId"> & {
    rootCommentId: string;
  },
) =>
  infiniteQueryOptions({
    queryKey: commentKeys.list({ ...query, mode: "root" }),
    queryFn: ({ pageParam }) =>
      pageParam
        ? commentApi.list({
            ...query,
            mode: "children",
            parentCommentId: query.rootCommentId,
            cursor: pageParam,
          })
        : commentApi.list({ ...query, mode: "root" }),
    initialPageParam: undefined as CommentListQuery["cursor"] | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const commentChildrenQuery = (
  query: Omit<CommentListQuery, "mode" | "rootCommentId"> & {
    parentCommentId: string;
  },
) => commentListQuery({ ...query, mode: "children" });

export const commentListBodyQuery = (body: CommentListBody) =>
  queryOptions({
    queryKey: commentKeys.list(body),
    queryFn: () => commentApi.listByBody(body),
    enabled: !!body.rootUnitId,
  });

export const commentQueries = {
  detail: commentQuery,
  list: commentListQuery,
  discovery: commentDiscoveryQuery,
  discoveryInfinite: commentDiscoveryInfiniteQuery,
  root: commentRootQuery,
  rootChildrenInfinite: commentRootChildrenInfiniteQuery,
  children: commentChildrenQuery,
  listByBody: commentListBodyQuery,
};

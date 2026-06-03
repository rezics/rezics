import type { CommentListBody, CommentListQuery } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
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

export const commentListBodyQuery = (body: CommentListBody) =>
  queryOptions({
    queryKey: commentKeys.list(body),
    queryFn: () => commentApi.listByBody(body),
    enabled: !!body.rootUnitId,
  });

export const commentQueries = {
  detail: commentQuery,
  list: commentListQuery,
  listByBody: commentListBodyQuery,
};

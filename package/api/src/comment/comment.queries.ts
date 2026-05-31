import type { CommentListBody, CommentListQuery } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { commentApi } from "./comment.api";
import { commentKeys } from "./comment.keys";

export const commentQuery = (unitId: string) =>
  queryOptions({
    queryKey: commentKeys.detail(unitId),
    queryFn: () => commentApi.get(unitId),
    enabled: !!unitId,
  });

export const commentListQuery = (query: CommentListQuery) =>
  queryOptions({
    queryKey: commentKeys.list(query),
    queryFn: () => commentApi.list(query),
    enabled: !!query.rootUnitId && !!query.realmUnitId,
  });

export const commentListBodyQuery = (body: CommentListBody) =>
  queryOptions({
    queryKey: commentKeys.list(body),
    queryFn: () => commentApi.listByBody(body),
    enabled: !!body.rootUnitId && !!body.realmUnitId,
  });

export const commentQueries = {
  detail: commentQuery,
  list: commentListQuery,
  listByBody: commentListBodyQuery,
};

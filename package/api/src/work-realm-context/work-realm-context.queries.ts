import type {
  ListWorkRealmContextQuery,
  ResolveWorkRealmContextQuery,
} from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { workRealmContextApi } from "./work-realm-context.api";
import { workRealmContextKeys } from "./work-realm-context.keys";

export const workRealmContextListQueryOptions = (
  query?: ListWorkRealmContextQuery,
) =>
  queryOptions({
    queryKey: workRealmContextKeys.list(query),
    queryFn: () => workRealmContextApi.list(query),
    staleTime: 1000 * 60 * 5,
  });

export const workRealmContextDetailQueryOptions = (contextId: string) =>
  queryOptions({
    queryKey: workRealmContextKeys.detail(contextId),
    queryFn: () => workRealmContextApi.get(contextId),
    enabled: !!contextId,
    staleTime: 1000 * 60 * 10,
  });

export const workRealmContextResolveQueryOptions = (
  query: ResolveWorkRealmContextQuery,
) =>
  queryOptions({
    queryKey: workRealmContextKeys.resolve(query),
    queryFn: () => workRealmContextApi.resolve(query),
    enabled: !!query.releaseUnitId,
    staleTime: 1000 * 60 * 5,
  });

export const workRealmContextByReleaseQueryOptions = (
  releaseUnitId: string,
  query?: Omit<ResolveWorkRealmContextQuery, "releaseUnitId">,
) =>
  queryOptions({
    queryKey: workRealmContextKeys.byRelease(releaseUnitId, query),
    queryFn: () =>
      workRealmContextApi.resolve({
        ...query,
        releaseUnitId,
      }),
    enabled: !!releaseUnitId,
    staleTime: 1000 * 60 * 5,
  });

export function useWorkRealmContextList(query?: ListWorkRealmContextQuery) {
  return useQuery(workRealmContextListQueryOptions(query));
}

export function useWorkRealmContext(contextId: string) {
  return useQuery(workRealmContextDetailQueryOptions(contextId));
}

export function useResolveWorkRealmContext(
  query: ResolveWorkRealmContextQuery,
) {
  return useQuery(workRealmContextResolveQueryOptions(query));
}

export function useWorkRealmContextByRelease(
  releaseUnitId: string,
  query?: Omit<ResolveWorkRealmContextQuery, "releaseUnitId">,
) {
  return useQuery(workRealmContextByReleaseQueryOptions(releaseUnitId, query));
}

export const workRealmContextQueries = {
  list: workRealmContextListQueryOptions,
  detail: workRealmContextDetailQueryOptions,
  resolve: workRealmContextResolveQueryOptions,
  byRelease: workRealmContextByReleaseQueryOptions,
};

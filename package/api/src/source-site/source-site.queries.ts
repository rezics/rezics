import type { SourceSiteListQuery } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { sourceSiteApi } from "./source-site.api";
import { sourceSiteKeys } from "./source-site.keys";

export const sourceSiteListQueryOptions = (query?: SourceSiteListQuery) =>
  queryOptions({
    queryKey: sourceSiteKeys.list(query),
    queryFn: () => sourceSiteApi.list(query),
    staleTime: 1000 * 60 * 2,
  });

export const sourceSiteDetailQueryOptions = (entityUnitId: string) =>
  queryOptions({
    queryKey: sourceSiteKeys.detail(entityUnitId),
    queryFn: () => sourceSiteApi.get(entityUnitId),
    enabled: !!entityUnitId,
    staleTime: 1000 * 60 * 10,
  });

export function useSourceSiteList(query?: SourceSiteListQuery) {
  return useQuery(sourceSiteListQueryOptions(query));
}

export function useSourceSite(entityUnitId: string) {
  return useQuery(sourceSiteDetailQueryOptions(entityUnitId));
}

export const sourceSiteQueries = {
  list: sourceSiteListQueryOptions,
  detail: sourceSiteDetailQueryOptions,
};

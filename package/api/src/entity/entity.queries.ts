import type { EntityListQuery } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { entityApi } from "./entity.api";
import { entityKeys } from "./entity.keys";

export const entityListQueryOptions = (query?: EntityListQuery) =>
  queryOptions({
    queryKey: entityKeys.list(query),
    queryFn: () => entityApi.list(query),
    staleTime: 1000 * 60 * 2,
  });

export const entityDetailQueryOptions = (unitId: string) =>
  queryOptions({
    queryKey: entityKeys.detail(unitId),
    queryFn: () => entityApi.get(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 10,
  });

export const entityBySlugQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: entityKeys.bySlug(slug),
    queryFn: () => entityApi.getBySlug(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });

/**
 * Search query used by EntityPicker. Backed by `GET /entity?q=` (server-side
 * Postgres ilike on translation titles) in v1. The picker spec calls for a
 * Meili-backed result list; that is an internal upgrade path — the response
 * shape (`{ entities, total }`) and the consumer hook signature stay the same
 * when the server route is switched to `/meili/entities/search` later.
 */
export const entitySearchQueryOptions = (query?: EntityListQuery) => {
  const q = query?.q?.trim() ?? "";
  return queryOptions({
    queryKey: entityKeys.search(query),
    queryFn: () => entityApi.list(query),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 1,
  });
};

export function useEntity(unitId: string) {
  return useQuery(entityDetailQueryOptions(unitId));
}

export function useEntityBySlug(slug: string) {
  return useQuery(entityBySlugQueryOptions(slug));
}

export function useEntityList(query?: EntityListQuery) {
  return useQuery(entityListQueryOptions(query));
}

export function useEntitySearch(query?: EntityListQuery) {
  return useQuery(entitySearchQueryOptions(query));
}

export const entityQueries = {
  list: entityListQueryOptions,
  detail: entityDetailQueryOptions,
  bySlug: entityBySlugQueryOptions,
  search: entitySearchQueryOptions,
};

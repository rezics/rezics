import type { EntityListQuery, EntitySearchOptions } from "@rezics/contract";
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
 * Search query used by EntityPicker. Backed by the dedicated Meilisearch
 * entities index so role/kind facets and global/personal picker contexts use
 * the same search document.
 */
export const entitySearchQueryOptions = (query?: EntitySearchOptions) => {
  const q = query?.q?.trim() ?? "";
  return queryOptions({
    queryKey: entityKeys.search(query),
    queryFn: () => entityApi.search(query),
    enabled:
      q.length > 0 ||
      Boolean(
        query?.kind ||
          query?.ownerUnitId ||
          query?.eligibleCreditRole ||
          query?.eligibleSubjectRole,
      ),
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

export function useEntitySearch(query?: EntitySearchOptions) {
  return useQuery(entitySearchQueryOptions(query));
}

export const entityQueries = {
  list: entityListQueryOptions,
  detail: entityDetailQueryOptions,
  bySlug: entityBySlugQueryOptions,
  search: entitySearchQueryOptions,
};

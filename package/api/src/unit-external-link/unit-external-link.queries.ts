import type {
  UnitExternalLinkListQuery,
  UnitExternalLinksBatchBody,
} from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { unitExternalLinkApi } from "./unit-external-link.api";
import { unitExternalLinkKeys } from "./unit-external-link.keys";

export const unitExternalLinkListQueryOptions = (
  query?: UnitExternalLinkListQuery,
) =>
  queryOptions({
    queryKey: unitExternalLinkKeys.list(query),
    queryFn: () => unitExternalLinkApi.list(query),
    staleTime: 1000 * 60 * 2,
  });

export const unitExternalLinksQueryOptions = (
  unitId: string,
  sourceEntityUnitId?: string,
) =>
  queryOptions({
    queryKey: unitExternalLinkKeys.links(unitId, sourceEntityUnitId),
    queryFn: () => unitExternalLinkApi.links(unitId, sourceEntityUnitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2,
  });

export const unitExternalLinksBatchQueryOptions = (
  input: UnitExternalLinksBatchBody,
) =>
  queryOptions({
    queryKey: unitExternalLinkKeys.linksBatch(input),
    queryFn: () => unitExternalLinkApi.linksBatch(input),
    enabled: input.unitIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

export function useUnitExternalLinkList(query?: UnitExternalLinkListQuery) {
  return useQuery(unitExternalLinkListQueryOptions(query));
}

export function useUnitExternalLinks(
  unitId: string,
  sourceEntityUnitId?: string,
) {
  return useQuery(unitExternalLinksQueryOptions(unitId, sourceEntityUnitId));
}

export function useUnitExternalLinksBatch(input: UnitExternalLinksBatchBody) {
  return useQuery(unitExternalLinksBatchQueryOptions(input));
}

export const unitExternalLinkQueries = {
  list: unitExternalLinkListQueryOptions,
  links: unitExternalLinksQueryOptions,
  linksBatch: unitExternalLinksBatchQueryOptions,
};

import type { UnitExternalRefListQuery } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { unitExternalRefApi } from "./unit-external-ref.api";
import { unitExternalRefKeys } from "./unit-external-ref.keys";

export const unitExternalRefListQueryOptions = (
  query?: UnitExternalRefListQuery,
) =>
  queryOptions({
    queryKey: unitExternalRefKeys.list(query),
    queryFn: () => unitExternalRefApi.list(query),
    staleTime: 1000 * 60 * 2,
  });

export const unitExternalRefParseUrlQueryOptions = (
  sourceSiteEntityUnitId: string,
  url: string,
) =>
  queryOptions({
    queryKey: unitExternalRefKeys.parseUrl(sourceSiteEntityUnitId, url),
    queryFn: () => unitExternalRefApi.parseUrl({ sourceSiteEntityUnitId, url }),
    enabled: !!sourceSiteEntityUnitId && !!url,
    staleTime: 1000 * 60 * 10,
  });

export function useUnitExternalRefList(query?: UnitExternalRefListQuery) {
  return useQuery(unitExternalRefListQueryOptions(query));
}

export function useUnitExternalRefUrlParse(
  sourceSiteEntityUnitId: string,
  url: string,
) {
  return useQuery(
    unitExternalRefParseUrlQueryOptions(sourceSiteEntityUnitId, url),
  );
}

export const unitExternalRefQueries = {
  list: unitExternalRefListQueryOptions,
  parseUrl: unitExternalRefParseUrlQueryOptions,
};

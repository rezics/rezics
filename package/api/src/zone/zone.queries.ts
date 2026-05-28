import { queryOptions } from "@tanstack/react-query";
import { zoneApi } from "./zone.api";
import { zoneKeys } from "./zone.keys";

export const zoneQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: zoneKeys.detail(slug),
    queryFn: () => zoneApi.getBySlug(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });

export const zoneByUnitIdQueryOptions = (unitId: string) =>
  queryOptions({
    queryKey: zoneKeys.byUnitId(unitId),
    queryFn: () => zoneApi.get(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 10,
  });

export const zoneQueries = {
  detail: zoneQueryOptions,
  byUnitId: zoneByUnitIdQueryOptions,
};

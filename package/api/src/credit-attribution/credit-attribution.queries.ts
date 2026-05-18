import { queryOptions } from "@tanstack/react-query";
import { creditAttributionApi } from "./credit-attribution.api";
import { creditAttributionKeys } from "./credit-attribution.keys";

export const creditAttributionsByUnitQueryOptions = (unitId: string) =>
  queryOptions({
    queryKey: creditAttributionKeys.byUnit(unitId),
    queryFn: () => creditAttributionApi.listByUnit(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

export const creditAttributionQueries = {
  byUnit: creditAttributionsByUnitQueryOptions,
};

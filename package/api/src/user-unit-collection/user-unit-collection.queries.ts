import { queryOptions } from "@tanstack/react-query";
import { userUnitCollectionApi } from "./user-unit-collection.api";
import { userUnitCollectionKeys } from "./user-unit-collection.keys";

export const userUnitCollectionForUnitQuery = (unitId: string) =>
  queryOptions({
    queryKey: userUnitCollectionKeys.unit(unitId),
    queryFn: () => userUnitCollectionApi.getForUnit(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });

export const userUnitCollectionQueries = {
  forUnit: userUnitCollectionForUnitQuery,
};

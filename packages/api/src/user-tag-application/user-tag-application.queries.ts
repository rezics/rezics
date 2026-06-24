import { queryOptions } from "@tanstack/react-query";
import { userTagApplicationApi } from "./user-tag-application.api";
import { userTagApplicationKeys } from "./user-tag-application.keys";

export const userTagApplicationsForUnitQuery = (unitId: string) =>
  queryOptions({
    queryKey: userTagApplicationKeys.unit(unitId),
    queryFn: () => userTagApplicationApi.listForUnit(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });

export const userTagApplicationQueries = {
  forUnit: userTagApplicationsForUnitQuery,
};

import { queryOptions } from "@tanstack/react-query";
import { workMaintenanceApi } from "./work-maintenance.api";
import { workMaintenanceKeys } from "./work-maintenance.keys";

export const workMaintenanceQuery = (unitId: string) =>
  queryOptions({
    queryKey: workMaintenanceKeys.detail(unitId),
    queryFn: () => workMaintenanceApi.get(unitId),
    staleTime: 1000 * 60 * 5,
  });

export const workMaintenanceQueries = {
  detail: workMaintenanceQuery,
};

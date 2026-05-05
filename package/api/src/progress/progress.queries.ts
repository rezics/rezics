import type { UnitProgressListQuery } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { progressApi } from "./progress.api";
import { progressKeys } from "./progress.keys";

export const unitProgressQuery = (unitId: string) =>
  queryOptions({
    queryKey: progressKeys.unit(unitId),
    queryFn: () => progressApi.getUnitProgress(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });

export const myProgressListQuery = (query?: UnitProgressListQuery) =>
  queryOptions({
    queryKey: progressKeys.list(query),
    queryFn: () => progressApi.listMyProgress(query),
    staleTime: 1000 * 30,
  });

export function useUnitProgress(unitId: string) {
  return useQuery(unitProgressQuery(unitId));
}

export function useMyProgressList(query?: UnitProgressListQuery) {
  return useQuery(myProgressListQuery(query));
}

export const progressQueries = {
  unit: unitProgressQuery,
  list: myProgressListQuery,
};

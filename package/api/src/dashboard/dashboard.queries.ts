import { queryOptions, useQuery } from "@tanstack/react-query";
import { dashboardApi } from "./dashboard.api";
import { dashboardKeys } from "./dashboard.keys";

export const dashboardSummaryQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.summary(),
    queryFn: () => dashboardApi.getSummary(),
    staleTime: 1000 * 30,
  });

export function useDashboardSummary(options?: { enabled?: boolean }) {
  return useQuery({ ...dashboardSummaryQuery(), enabled: options?.enabled });
}

export const dashboardQueries = {
  summary: dashboardSummaryQuery,
};

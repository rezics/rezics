import type { DashboardSummaryQuery } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { dashboardApi } from "./dashboard.api";
import { dashboardKeys } from "./dashboard.keys";

export const dashboardSummaryQuery = (query?: DashboardSummaryQuery) =>
  queryOptions({
    queryKey: dashboardKeys.summary(query),
    queryFn: () => dashboardApi.getSummary(query),
    staleTime: 1000 * 30,
  });

export function useDashboardSummary(options?: {
  enabled?: boolean;
  query?: DashboardSummaryQuery;
}) {
  return useQuery({
    ...dashboardSummaryQuery(options?.query),
    enabled: options?.enabled,
  });
}

export const dashboardQueries = {
  summary: dashboardSummaryQuery,
};

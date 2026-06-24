import { queryOptions } from "@tanstack/react-query";
import { adminStatsApi } from "./stats.api";
import { adminStatsKeys } from "./stats.keys";

export const adminStatsQueryOptions = () =>
  queryOptions({
    queryKey: adminStatsKeys.stats(),
    queryFn: () => adminStatsApi.getStats(),
    staleTime: 60_000,
  });

export const adminDashboardSummaryQueryOptions = () =>
  queryOptions({
    queryKey: adminStatsKeys.dashboardSummary(),
    queryFn: () => adminStatsApi.getDashboardSummary(),
    staleTime: 30_000,
  });

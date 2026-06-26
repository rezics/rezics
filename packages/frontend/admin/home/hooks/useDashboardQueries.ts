import type {
  AdminDashboardSummary,
  AdminStatsResponse,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient } from "@/lib/api-client";

const ADMIN_STATS_KEY = ["eden", "admin", "stats"] as const;
const ADMIN_DASHBOARD_SUMMARY_KEY = [
  "eden",
  "admin",
  "stats",
  "dashboard-summary",
] as const;

const getAdminStats = createEdenFetcher<
  AdminStatsResponse,
  typeof ADMIN_STATS_KEY
>(() => apiClient.admin.stats.get());

const getAdminDashboardSummary = createEdenFetcher<
  AdminDashboardSummary,
  typeof ADMIN_DASHBOARD_SUMMARY_KEY
>(() => apiClient.admin.stats["dashboard-summary"].get());

export function useAdminStatsQuery() {
  return useAdminEdenQuery(ADMIN_STATS_KEY, getAdminStats, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
}

export function useAdminDashboardSummaryQuery() {
  return useAdminEdenQuery(
    ADMIN_DASHBOARD_SUMMARY_KEY,
    getAdminDashboardSummary,
    {
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );
}

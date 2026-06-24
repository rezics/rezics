import type {
  AdminDashboardSummary,
  AdminStatsResponse,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const ADMIN_STATS_KEY = ["eden", "admin", "stats"] as const;
const ADMIN_DASHBOARD_SUMMARY_KEY = [
  "eden",
  "admin",
  "stats",
  "dashboard-summary",
] as const;

async function getAdminStats(): Promise<AdminStatsResponse> {
  const response = await apiClient.admin.stats.get();
  return unwrapEdenResponse(response);
}

async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const response = await apiClient.admin.stats["dashboard-summary"].get();
  return unwrapEdenResponse(response);
}

export function useAdminStatsQuery() {
  return useSWR<AdminStatsResponse>(ADMIN_STATS_KEY, getAdminStats, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
}

export function useAdminDashboardSummaryQuery() {
  return useSWR<AdminDashboardSummary>(
    ADMIN_DASHBOARD_SUMMARY_KEY,
    getAdminDashboardSummary,
    {
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );
}

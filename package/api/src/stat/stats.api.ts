import type {
  AdminDashboardSummary,
  AdminStatsResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const adminStatsApi = {
  getStats: async (): Promise<AdminStatsResponse> => {
    return apiFetch<AdminStatsResponse>("/admin/stats");
  },

  getDashboardSummary: async (): Promise<AdminDashboardSummary> => {
    return apiFetch<AdminDashboardSummary>("/admin/stats/dashboard-summary");
  },
};

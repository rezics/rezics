import type { DashboardSummary } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    return apiFetch<DashboardSummary>("/me/dashboard");
  },
};

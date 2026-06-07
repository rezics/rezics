import type { DashboardSummary, DashboardSummaryQuery } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const dashboardApi = {
  getSummary: async (
    query?: DashboardSummaryQuery,
  ): Promise<DashboardSummary> => {
    return apiFetch<DashboardSummary>(
      `/me/dashboard${buildQueryString(query ?? {})}`,
    );
  },
};

import { apiFetch } from "../react-query/http";
import type { MeiliStatusSummary, SystemStatusSummary } from "./status.types";

export const statusApi = {
  getMeiliStatus: async (): Promise<MeiliStatusSummary> => {
    return apiFetch<MeiliStatusSummary>("/meili/status");
  },

  getSystemStatus: async (): Promise<SystemStatusSummary> => {
    return apiFetch<SystemStatusSummary>("/diagnostic/system");
  },
};

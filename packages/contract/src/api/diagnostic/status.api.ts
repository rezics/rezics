import { apiFetch } from "../react-query/http";
import type { EdenResponse } from "../eden";
import type { MeiliStatusSummary, SystemStatusSummary } from "./status.types";

export type StatusEdenClient = {
  diagnostic: {
    system: {
      get: () => Promise<EdenResponse<SystemStatusSummary>>;
    };
  };
  meili: {
    status: {
      get: () => Promise<EdenResponse<MeiliStatusSummary>>;
    };
  };
};

export const statusApi = {
  getMeiliStatus: async (): Promise<MeiliStatusSummary> => {
    return apiFetch<MeiliStatusSummary>("/meili/status");
  },

  getSystemStatus: async (): Promise<SystemStatusSummary> => {
    return apiFetch<SystemStatusSummary>("/diagnostic/system");
  },
};

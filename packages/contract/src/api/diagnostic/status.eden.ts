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

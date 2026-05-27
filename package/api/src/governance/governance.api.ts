import type { CapabilityHint } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export type GovernanceCapabilityHintsResponse = {
  capabilities: CapabilityHint[];
};

export const governanceApi = {
  capabilityHints: async (): Promise<GovernanceCapabilityHintsResponse> => {
    return apiFetch<GovernanceCapabilityHintsResponse>(
      "/governance/capability-hints/me",
    );
  },
};

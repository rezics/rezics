import type { WorkLinkClaimDTO } from "@rezics/contract";

export const workLinkKeys = {
  all: () => ["work-link"] as const,
  claims: () => [...workLinkKeys.all(), "claims"] as const,
  claimsByWork: (workUnitId: string, status?: WorkLinkClaimDTO["status"]) =>
    [...workLinkKeys.claims(), workUnitId, status ?? null] as const,
} as const;

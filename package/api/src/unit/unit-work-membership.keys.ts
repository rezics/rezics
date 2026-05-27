import type { WorkMembershipClaimDTO } from "@rezics/contract";

export const unitWorkMembershipKeys = {
  all: () => ["unit-work-membership"] as const,
  claims: () => [...unitWorkMembershipKeys.all(), "claims"] as const,
  claimsByWork: (
    workUnitId: string,
    status?: WorkMembershipClaimDTO["status"],
  ) =>
    [...unitWorkMembershipKeys.claims(), workUnitId, status ?? null] as const,
} as const;

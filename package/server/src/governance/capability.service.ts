import type { CapabilityHint } from "@rezics/contract";
import { prisma } from "#/prisma/client";

function isActiveGrant(row: { state: string; expiresAt: Date | null }) {
  return (
    row.state === "ACTIVE" && (!row.expiresAt || row.expiresAt > new Date())
  );
}

export class GovernanceCapabilityService {
  async resolveForUser(userId: string): Promise<CapabilityHint[]> {
    const [staffGrants, realmGrants] = await Promise.all([
      prisma.staffGrant.findMany({ where: { userId } }),
      prisma.realmCapabilityGrant.findMany({ where: { userId } }),
    ]);

    return [
      ...staffGrants.filter(isActiveGrant).map((grant) => ({
        capability: grant.capability as CapabilityHint["capability"],
        scope: {
          kind: grant.scopeKind as CapabilityHint["scope"]["kind"],
          ...(grant.realmUnitId ? { realmUnitId: grant.realmUnitId } : {}),
        },
        expiresAt: grant.expiresAt?.toISOString() ?? null,
      })),
      ...realmGrants.filter(isActiveGrant).map((grant) => ({
        capability: grant.capability as CapabilityHint["capability"],
        scope: { kind: "realm" as const, realmUnitId: grant.realmUnitId },
        expiresAt: grant.expiresAt?.toISOString() ?? null,
      })),
    ];
  }
}

export const governanceCapabilityService = new GovernanceCapabilityService();

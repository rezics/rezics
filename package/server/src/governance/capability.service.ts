import type {
  Capability,
  CapabilityHint,
  GrantCapabilityInput,
  Permission,
} from "@rezics/contract";
import { capabilityKeys } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { mapRealmGrantToCapabilityDTO } from "./governance.mapper";

function isActiveGrant(row: { state: string; expiresAt: Date | null }) {
  return (
    row.state === "ACTIVE" && (!row.expiresAt || row.expiresAt > new Date())
  );
}

const realmCapabilityRoles = new Set(["owner", "admin", "moderator"]);

export class GovernanceCapabilityService {
  async resolveHintsForIdentity(input: {
    userId: string;
    permission?: Permission | null;
  }): Promise<CapabilityHint[]> {
    if (input.permission?.role === "ROOT") {
      return capabilityKeys.map((capability) => ({
        capability,
        scope: { kind: "global" as const },
      }));
    }

    return this.resolveForUser(input.userId);
  }

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

  async realmMembershipForPolicy(realmUnitId: string, userId: string) {
    const member = await prisma.realmMember.findUnique({
      where: { realmUnitId_userId: { realmUnitId, userId } },
    });

    if (!member) return null;

    const capabilities = await this.resolveForUser(userId);
    const roleCapabilities: CapabilityHint[] = realmCapabilityRoles.has(
      member.roleKey,
    )
      ? [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId },
          },
        ]
      : [];

    return {
      realmUnitId,
      role: member.roleKey as "member" | "moderator" | "admin" | "owner",
      capabilities: [
        ...roleCapabilities,
        ...capabilities.filter(
          (hint) =>
            hint.scope.kind === "realm" &&
            hint.scope.realmUnitId === realmUnitId,
        ),
      ],
    };
  }

  async listRealmGrants(realmUnitId: string, userId: string) {
    const rows = await prisma.realmCapabilityGrant.findMany({
      where: { realmUnitId, userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRealmGrantToCapabilityDTO);
  }

  async grantRealmCapability(
    input: GrantCapabilityInput & {
      realmUnitId: string;
      userId: string;
      grantedById: string;
    },
  ) {
    const row = await prisma.realmCapabilityGrant.create({
      data: {
        realmUnitId: input.realmUnitId,
        userId: input.userId,
        capability: input.capability,
        grantedById: input.grantedById,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
    return mapRealmGrantToCapabilityDTO(row);
  }

  async revokeRealmCapability(input: {
    realmUnitId: string;
    userId: string;
    capability: Capability;
    revokedById: string;
  }) {
    const rows = await prisma.realmCapabilityGrant.findMany({
      where: {
        realmUnitId: input.realmUnitId,
        userId: input.userId,
        capability: input.capability,
        state: "ACTIVE",
      },
    });

    const revoked = await Promise.all(
      rows.map((row) =>
        prisma.realmCapabilityGrant.update({
          where: { id: row.id },
          data: {
            state: "REVOKED",
            revokedAt: new Date(),
            revokedById: input.revokedById,
          },
        }),
      ),
    );

    return revoked.map(mapRealmGrantToCapabilityDTO);
  }
}

export const governanceCapabilityService = new GovernanceCapabilityService();

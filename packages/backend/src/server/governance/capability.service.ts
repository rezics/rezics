import type {
  Capability,
  CapabilityHint,
  GrantCapabilityInput,
  Permission,
} from "@rezics/contract";
import { capabilityKeys } from "@rezics/contract";
import { and, desc, eq } from "drizzle-orm";
import { RealmCapabilityGrant, RealmMember, StaffGrant } from "../db/schema";
import { mapRealmGrantToCapabilityDTO } from "./governance.mapper";
import type { RealmCapabilityGrantRow, StaffGrantRow } from "./types";

function isActiveGrant(row: { state: string; expiresAt: Date | null }) {
  return (
    row.state === "ACTIVE" && (!row.expiresAt || row.expiresAt > new Date())
  );
}

const realmCapabilityRoles = new Set(["owner", "admin", "moderator"]);

type RealmMemberPolicyRow = typeof RealmMember.$inferSelect;

export interface GovernanceCapabilityRepository {
  listStaffGrants(userId: string): Promise<StaffGrantRow[]>;
  listRealmGrantsForUser(userId: string): Promise<RealmCapabilityGrantRow[]>;
  getRealmMember(
    realmUnitId: string,
    userId: string,
  ): Promise<RealmMemberPolicyRow | null>;
  listRealmGrants(
    realmUnitId: string,
    userId: string,
  ): Promise<RealmCapabilityGrantRow[]>;
  createRealmGrant(input: {
    realmUnitId: string;
    userId: string;
    capability: Capability;
    grantedById: string;
    expiresAt: Date | null;
  }): Promise<RealmCapabilityGrantRow>;
  listActiveRealmGrants(input: {
    realmUnitId: string;
    userId: string;
    capability: Capability;
  }): Promise<RealmCapabilityGrantRow[]>;
  revokeRealmGrant(
    id: string,
    revokedById: string,
  ): Promise<RealmCapabilityGrantRow>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleGovernanceCapabilityRepository(): GovernanceCapabilityRepository {
  return {
    async listStaffGrants(userId) {
      const db = await getServerDb();
      return db.select().from(StaffGrant).where(eq(StaffGrant.userId, userId));
    },

    async listRealmGrantsForUser(userId) {
      const db = await getServerDb();
      return db
        .select()
        .from(RealmCapabilityGrant)
        .where(eq(RealmCapabilityGrant.userId, userId));
    },

    async getRealmMember(realmUnitId, userId) {
      const db = await getServerDb();
      const [member] = await db
        .select()
        .from(RealmMember)
        .where(
          and(
            eq(RealmMember.realmUnitId, realmUnitId),
            eq(RealmMember.userId, userId),
          ),
        )
        .limit(1);
      return member ?? null;
    },

    async listRealmGrants(realmUnitId, userId) {
      const db = await getServerDb();
      return db
        .select()
        .from(RealmCapabilityGrant)
        .where(
          and(
            eq(RealmCapabilityGrant.realmUnitId, realmUnitId),
            eq(RealmCapabilityGrant.userId, userId),
          ),
        )
        .orderBy(desc(RealmCapabilityGrant.createdAt));
    },

    async createRealmGrant(input) {
      const db = await getServerDb();
      const [row] = await db
        .insert(RealmCapabilityGrant)
        .values({
          realmUnitId: input.realmUnitId,
          userId: input.userId,
          capability: input.capability,
          grantedById: input.grantedById,
          expiresAt: input.expiresAt,
          updatedAt: new Date(),
        })
        .returning();
      if (!row) throw new Error("Failed to create RealmCapabilityGrant");
      return row;
    },

    async listActiveRealmGrants(input) {
      const db = await getServerDb();
      return db
        .select()
        .from(RealmCapabilityGrant)
        .where(
          and(
            eq(RealmCapabilityGrant.realmUnitId, input.realmUnitId),
            eq(RealmCapabilityGrant.userId, input.userId),
            eq(RealmCapabilityGrant.capability, input.capability),
            eq(RealmCapabilityGrant.state, "ACTIVE"),
          ),
        );
    },

    async revokeRealmGrant(id, revokedById) {
      const db = await getServerDb();
      const [row] = await db
        .update(RealmCapabilityGrant)
        .set({
          state: "REVOKED",
          revokedAt: new Date(),
          revokedById,
          updatedAt: new Date(),
        })
        .where(eq(RealmCapabilityGrant.id, id))
        .returning();
      if (!row) throw new Error("Failed to revoke RealmCapabilityGrant");
      return row;
    },
  };
}

const defaultRepository = createDrizzleGovernanceCapabilityRepository();

export class GovernanceCapabilityService {
  constructor(
    private readonly repository: GovernanceCapabilityRepository = defaultRepository,
  ) {}

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
      this.repository.listStaffGrants(userId),
      this.repository.listRealmGrantsForUser(userId),
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
    const member = await this.repository.getRealmMember(realmUnitId, userId);

    if (!member) return null;

    const capabilities = await this.resolveForUser(userId);
    const roleCapabilities: CapabilityHint[] = realmCapabilityRoles.has(
      member.roleKey,
    )
      ? [
          {
            capability: "content.pin",
            scope: { kind: "realm", realmUnitId },
          },
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId },
          },
          {
            capability: "comment.moderate",
            scope: { kind: "realm", realmUnitId },
          },
          {
            capability: "realm.member.moderate",
            scope: { kind: "realm", realmUnitId },
          },
          {
            capability: "tag.curate",
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
    const rows = await this.repository.listRealmGrants(realmUnitId, userId);
    return rows.map(mapRealmGrantToCapabilityDTO);
  }

  async grantRealmCapability(
    input: GrantCapabilityInput & {
      realmUnitId: string;
      userId: string;
      grantedById: string;
    },
  ) {
    const row = await this.repository.createRealmGrant({
      realmUnitId: input.realmUnitId,
      userId: input.userId,
      capability: input.capability,
      grantedById: input.grantedById,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    return mapRealmGrantToCapabilityDTO(row);
  }

  async revokeRealmCapability(input: {
    realmUnitId: string;
    userId: string;
    capability: Capability;
    revokedById: string;
  }) {
    const rows = await this.repository.listActiveRealmGrants(input);

    const revoked = await Promise.all(
      rows.map((row) =>
        this.repository.revokeRealmGrant(row.id, input.revokedById),
      ),
    );

    return revoked.map(mapRealmGrantToCapabilityDTO);
  }
}

export const governanceCapabilityService = new GovernanceCapabilityService();

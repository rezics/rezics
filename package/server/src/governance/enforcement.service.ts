import type {
  AccountEnforcementKind,
  CreateAccountEnforcementInput,
  UnblockAccountEnforcementInput,
} from "@rezics/contract";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { revokeAuthSessionsForAuthUser } from "../auth-boundary/auth-internal.client";
import type { ServerDb } from "../db/client";
import {
  AccountEnforcement,
  AccountEnforcementKind as AccountEnforcementKindEnum,
  User,
} from "../db/schema";
import { broadcast } from "../notify-boundary/notify-boundary.client";
import { mapAccountEnforcementToDTO } from "./governance.mapper";
import {
  moderationActionService,
  type ModerationActionService,
} from "./moderation-action.service";
import type { AccountEnforcementRow, GovernanceListOptions } from "./types";

type EnforcementKindStorage =
  (typeof AccountEnforcementKindEnum.enumValues)[number];
type EnforcementActionResult = { id: string };
type EnforcementTx = Pick<ServerDb, "select" | "insert" | "update">;

const enforcementKindMap: Record<
  AccountEnforcementKind,
  EnforcementKindStorage
> = {
  warning: "WARNING",
  silence: "SILENCE",
  suspension: "SUSPENSION",
  ban: "BAN",
  rate_limit: "RATE_LIMIT",
  trust_restriction: "TRUST_RESTRICTION",
};

const blockingEnforcementKinds = [
  "SILENCE",
  "SUSPENSION",
  "BAN",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
] as const;

function notifyEnforcement(input: {
  kind: "moderation.subject.warning" | "moderation.appeal.updated";
  targetUserId: string;
  actorUserId?: string | null;
  extra?: Record<string, unknown>;
}) {
  broadcast({
    kind: input.kind,
    sourceUnitId: input.targetUserId,
    directRecipients: [input.targetUserId],
    actorId: input.actorUserId ?? null,
    extra: input.extra,
  }).catch(() => {});
}

function basePermissionRole(permission: unknown) {
  const role =
    permission &&
    typeof permission === "object" &&
    "role" in permission &&
    Array.isArray((permission as { role?: unknown }).role)
      ? ((permission as { role: string[] }).role[0] ?? "MEMBER")
      : permission &&
          typeof permission === "object" &&
          "role" in permission &&
          typeof (permission as { role?: unknown }).role === "string"
        ? (permission as { role: string }).role
        : "MEMBER";

  return role === "BLOCKED" ? "MEMBER" : role;
}

export interface GovernanceEnforcementRepository {
  listActive(targetUserId: string, now: Date): Promise<AccountEnforcementRow[]>;
  list(
    targetUserId: string,
    options: GovernanceListOptions,
  ): Promise<AccountEnforcementRow[]>;
  getAuthUserId(userId: string): Promise<string | null>;
  create(input: {
    targetUserId: string;
    kind: AccountEnforcementKind;
    reason: string;
    safeMessage?: string | null;
    decidedById: string;
    decisionCode: string;
    expiresAt?: Date | null;
    metadata?: Record<string, unknown>;
    appendAction: (
      tx: EnforcementTx,
      row: AccountEnforcementRow,
    ) => Promise<EnforcementActionResult>;
  }): Promise<AccountEnforcementRow>;
  revokeActive(input: {
    targetUserId: string;
    now: Date;
    safeMessage?: string | null;
    reason: string;
    revokedById: string;
    metadata?: Record<string, unknown>;
    appendAction: (
      tx: EnforcementTx,
      row: AccountEnforcementRow,
    ) => Promise<EnforcementActionResult>;
  }): Promise<AccountEnforcementRow[]>;
}

function activeEnforcementWhere(targetUserId: string, now: Date) {
  return and(
    eq(AccountEnforcement.targetUserId, targetUserId),
    eq(AccountEnforcement.state, "ACTIVE"),
    or(
      isNull(AccountEnforcement.expiresAt),
      gt(AccountEnforcement.expiresAt, now),
    ),
  );
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleGovernanceEnforcementRepository(): GovernanceEnforcementRepository {
  return {
    async listActive(targetUserId, now) {
      const db = await getServerDb();
      return db
        .select()
        .from(AccountEnforcement)
        .where(activeEnforcementWhere(targetUserId, now))
        .orderBy(desc(AccountEnforcement.createdAt));
    },

    async list(targetUserId, options) {
      const db = await getServerDb();
      return db
        .select()
        .from(AccountEnforcement)
        .where(eq(AccountEnforcement.targetUserId, targetUserId))
        .orderBy(desc(AccountEnforcement.createdAt))
        .offset(options.offset ?? 0)
        .limit(options.limit ?? 50);
    },

    async getAuthUserId(userId) {
      const db = await getServerDb();
      const [user] = await db
        .select({ authUserId: User.authUserId })
        .from(User)
        .where(eq(User.unitId, userId))
        .limit(1);
      return user?.authUserId ?? null;
    },

    async create(input) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const now = new Date();
        const [created] = await tx
          .insert(AccountEnforcement)
          .values({
            targetUserId: input.targetUserId,
            kind: enforcementKindMap[input.kind],
            reason: input.reason,
            safeMessage: input.safeMessage ?? null,
            decidedById: input.decidedById,
            decisionCode: input.decisionCode,
            expiresAt: input.expiresAt ?? null,
            metadata: input.metadata,
            updatedAt: now,
          })
          .returning();
        if (!created) throw new Error("Failed to create AccountEnforcement");

        const action = await input.appendAction(tx, created);
        const [updated] = await tx
          .update(AccountEnforcement)
          .set({ decisionActionId: action.id, updatedAt: new Date() })
          .where(eq(AccountEnforcement.id, created.id))
          .returning();
        if (!updated)
          throw new Error("Failed to link AccountEnforcement decision action");
        return updated;
      });
    },

    async revokeActive(input) {
      const db = await getServerDb();
      const rows = await db
        .select()
        .from(AccountEnforcement)
        .where(
          and(
            activeEnforcementWhere(input.targetUserId, input.now),
            inArray(AccountEnforcement.kind, [...blockingEnforcementKinds]),
          ),
        )
        .orderBy(desc(AccountEnforcement.createdAt));

      return db.transaction(async (tx) => {
        const revoked: AccountEnforcementRow[] = [];
        for (const row of rows) {
          const [updated] = await tx
            .update(AccountEnforcement)
            .set({
              state: "REVOKED",
              revokedAt: input.now,
              revokedById: input.revokedById,
              safeMessage: input.safeMessage ?? row.safeMessage,
              metadata: {
                ...(row.metadata &&
                typeof row.metadata === "object" &&
                !Array.isArray(row.metadata)
                  ? row.metadata
                  : {}),
                unblockReason: input.reason,
                ...(input.metadata ?? {}),
              },
              updatedAt: new Date(),
            })
            .where(eq(AccountEnforcement.id, row.id))
            .returning();
          if (!updated) continue;

          const action = await input.appendAction(tx, row);
          const [withAction] = await tx
            .update(AccountEnforcement)
            .set({ revocationActionId: action.id, updatedAt: new Date() })
            .where(eq(AccountEnforcement.id, updated.id))
            .returning();
          if (withAction) revoked.push(withAction);
        }
        return revoked;
      });
    },
  };
}

const defaultRepository = createDrizzleGovernanceEnforcementRepository();

export class GovernanceEnforcementService {
  constructor(
    private readonly repository: GovernanceEnforcementRepository = defaultRepository,
    private readonly actions: ModerationActionService = moderationActionService,
  ) {}

  async activeSummary(targetUserId: string) {
    const now = new Date();
    const rows = await this.repository.listActive(targetUserId, now);

    const activeKinds = rows.map((row) =>
      row.kind.toLowerCase(),
    ) as AccountEnforcementKind[];

    return {
      targetUserId,
      activeKinds,
      strongestKind: activeKinds[0] ?? null,
      expiresAt: rows[0]?.expiresAt?.toISOString() ?? null,
    };
  }

  async projectedPermissionForUser(userId: string, storedPermission: unknown) {
    const active = await this.activeSummary(userId);
    return {
      role: active.activeKinds.includes("ban")
        ? "BLOCKED"
        : basePermissionRole(storedPermission),
    };
  }

  async list(targetUserId: string, options: GovernanceListOptions = {}) {
    const rows = await this.repository.list(targetUserId, options);
    return rows.map(mapAccountEnforcementToDTO);
  }

  async create(input: {
    targetUserId: string;
    kind: AccountEnforcementKind;
    reason: string;
    decidedById: string;
    decisionCode: string;
    safeMessage?: string | null;
    expiresAt?: Date | null;
    caseId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    let metadata = input.metadata;
    if (input.kind === "ban") {
      const authUserId = await this.repository.getAuthUserId(
        input.targetUserId,
      );
      if (authUserId) {
        const revocation = await revokeAuthSessionsForAuthUser({
          authUserId,
          reason: input.reason,
        });
        metadata = {
          ...(metadata ?? {}),
          authBoundary: {
            sessionRevocation: {
              attempted: true,
              ok: revocation.ok,
              revokedSessions: revocation.revokedSessions,
            },
          },
        };
      } else {
        metadata = {
          ...(metadata ?? {}),
          authBoundary: {
            sessionRevocation: {
              attempted: false,
              ok: null,
              revokedSessions: null,
            },
          },
        };
      }
    }

    const row = await this.repository.create({
      targetUserId: input.targetUserId,
      kind: input.kind,
      reason: input.reason,
      safeMessage: input.safeMessage,
      decidedById: input.decidedById,
      decisionCode: input.decisionCode,
      expiresAt: input.expiresAt,
      metadata,
      appendAction: (tx, created) =>
        this.actions.appendModerationAction(tx, {
          authority: "PLATFORM",
          targetKind: "ACCOUNT",
          targetId: input.targetUserId,
          actorKind: "USER",
          actorUserId: input.decidedById,
          actionKind: created.kind,
          reasonCode: input.decisionCode,
          reasonText: input.reason,
          caseId: input.caseId,
        }),
    });
    if (input.kind === "warning") {
      notifyEnforcement({
        kind: "moderation.subject.warning",
        targetUserId: input.targetUserId,
        actorUserId: input.decidedById,
        extra: { enforcementId: row.id, reason: input.reason },
      });
    }
    return mapAccountEnforcementToDTO(row);
  }

  async apply(
    targetUserId: string,
    input: CreateAccountEnforcementInput & {
      decidedById: string;
      decisionCode: string;
    },
  ) {
    return this.create({
      targetUserId,
      kind: input.kind,
      reason: input.reason,
      safeMessage: input.safeMessage,
      decidedById: input.decidedById,
      decisionCode: input.decisionCode,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      caseId: input.caseId,
      metadata: input.metadata,
    });
  }

  warn(
    targetUserId: string,
    input: Omit<CreateAccountEnforcementInput, "kind"> & {
      decidedById: string;
      decisionCode: string;
    },
  ) {
    return this.apply(targetUserId, { ...input, kind: "warning" });
  }

  silence(
    targetUserId: string,
    input: Omit<CreateAccountEnforcementInput, "kind"> & {
      decidedById: string;
      decisionCode: string;
    },
  ) {
    return this.apply(targetUserId, { ...input, kind: "silence" });
  }

  suspend(
    targetUserId: string,
    input: Omit<CreateAccountEnforcementInput, "kind"> & {
      decidedById: string;
      decisionCode: string;
    },
  ) {
    return this.apply(targetUserId, { ...input, kind: "suspension" });
  }

  ban(
    targetUserId: string,
    input: Omit<CreateAccountEnforcementInput, "kind"> & {
      decidedById: string;
      decisionCode: string;
    },
  ) {
    return this.apply(targetUserId, { ...input, kind: "ban" });
  }

  rateLimit(
    targetUserId: string,
    input: Omit<CreateAccountEnforcementInput, "kind"> & {
      decidedById: string;
      decisionCode: string;
    },
  ) {
    return this.apply(targetUserId, { ...input, kind: "rate_limit" });
  }

  trustRestriction(
    targetUserId: string,
    input: Omit<CreateAccountEnforcementInput, "kind"> & {
      decidedById: string;
      decisionCode: string;
    },
  ) {
    return this.apply(targetUserId, { ...input, kind: "trust_restriction" });
  }

  async unblock(
    targetUserId: string,
    input: UnblockAccountEnforcementInput & { revokedById: string },
  ) {
    const now = new Date();
    const rows = await this.repository.revokeActive({
      targetUserId,
      now,
      safeMessage: input.safeMessage,
      reason: input.reason,
      revokedById: input.revokedById,
      metadata: input.metadata,
      appendAction: (tx, row) =>
        this.actions.appendModerationAction(tx, {
          authority: "PLATFORM",
          targetKind: "ACCOUNT",
          targetId: targetUserId,
          actorKind: "USER",
          actorUserId: input.revokedById,
          actionKind: "REVOKE_ENFORCEMENT",
          reasonCode: "account.enforcement.revoked",
          reasonText: input.reason,
          caseId: input.caseId,
          reversesActionId: row.decisionActionId,
        }),
    });

    for (const row of rows) {
      notifyEnforcement({
        kind: "moderation.appeal.updated",
        targetUserId,
        actorUserId: input.revokedById,
        extra: { enforcementId: row.id, state: row.state },
      });
    }
    return rows.map(mapAccountEnforcementToDTO);
  }
}

export const governanceEnforcementService = new GovernanceEnforcementService();

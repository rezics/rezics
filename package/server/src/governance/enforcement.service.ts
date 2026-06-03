import type {
  AccountEnforcementKind,
  CreateAccountEnforcementInput,
  UnblockAccountEnforcementInput,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { revokeAuthSessionsForAuthUser } from "../auth-boundary/auth-internal.client";
import { governanceAuditService } from "./audit.service";
import { mapAccountEnforcementToDTO } from "./governance.mapper";
import { moderationActionService } from "./moderation-action.service";
import type { GovernanceListOptions } from "./types";

const enforcementKindMap: Record<AccountEnforcementKind, any> = {
  warning: "WARNING",
  silence: "SILENCE",
  suspension: "SUSPENSION",
  ban: "BAN",
  rate_limit: "RATE_LIMIT",
  trust_restriction: "TRUST_RESTRICTION",
};

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

function auditEnforcement(
  input: Parameters<typeof governanceAuditService.appendPrivilegedMutation>[0],
) {
  governanceAuditService.appendPrivilegedMutation(input).catch(() => {});
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

export class GovernanceEnforcementService {
  async activeSummary(targetUserId: string) {
    const now = new Date();
    const rows = await prisma.accountEnforcement.findMany({
      where: {
        targetUserId,
        state: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    });

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
    const rows = await prisma.accountEnforcement.findMany({
      where: { targetUserId },
      orderBy: { createdAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
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
      const user = await prisma.user.findUnique({
        where: { unitId: input.targetUserId },
        select: { authUserId: true },
      });
      if (user?.authUserId) {
        const revocation = await revokeAuthSessionsForAuthUser({
          authUserId: user.authUserId,
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

    const row = await prisma.$transaction(async (tx: any) => {
      const created = await tx.accountEnforcement.create({
        data: {
          targetUserId: input.targetUserId,
          kind: enforcementKindMap[input.kind],
          reason: input.reason,
          safeMessage: input.safeMessage ?? null,
          decidedById: input.decidedById,
          decisionCode: input.decisionCode,
          expiresAt: input.expiresAt ?? null,
          metadata: metadata as never,
        },
      });
      const action = await moderationActionService.appendModerationAction(tx, {
        authority: "PLATFORM",
        targetKind: "ACCOUNT",
        targetId: input.targetUserId,
        actorKind: "USER",
        actorUserId: input.decidedById,
        actionKind: created.kind,
        reasonCode: input.decisionCode,
        reasonText: input.reason,
        caseId: input.caseId,
      });
      return tx.accountEnforcement.update({
        where: { id: created.id },
        data: { decisionActionId: action.id },
      });
    });
    if (input.kind === "warning") {
      notifyEnforcement({
        kind: "moderation.subject.warning",
        targetUserId: input.targetUserId,
        actorUserId: input.decidedById,
        extra: { enforcementId: row.id, reason: input.reason },
      });
    }
    auditEnforcement({
      actorUserId: input.decidedById,
      action: "account.enforcement.applied",
      targetKind: "account",
      targetId: input.targetUserId,
      decisionCode: input.decisionCode,
      reason: input.reason,
      correlationId: input.caseId ?? row.id,
      after: { enforcementId: row.id, kind: row.kind, state: row.state },
    });
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
    const activeRows = await prisma.accountEnforcement.findMany({
      where: {
        targetUserId,
        state: "ACTIVE",
        kind: {
          in: [
            "SILENCE",
            "SUSPENSION",
            "BAN",
            "RATE_LIMIT",
            "TRUST_RESTRICTION",
          ],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = await prisma.$transaction((tx: any) =>
      Promise.all(
        activeRows.map(async (row) => {
          const updated = await tx.accountEnforcement.update({
            where: { id: row.id },
            data: {
              state: "REVOKED",
              revokedAt: now,
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
              } as never,
            },
          });
          const action = await moderationActionService.appendModerationAction(
            tx,
            {
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
            },
          );
          return tx.accountEnforcement.update({
            where: { id: updated.id },
            data: { revocationActionId: action.id },
          });
        }),
      ),
    );

    for (const row of rows) {
      notifyEnforcement({
        kind: "moderation.appeal.updated",
        targetUserId,
        actorUserId: input.revokedById,
        extra: { enforcementId: row.id, state: row.state },
      });
      auditEnforcement({
        actorUserId: input.revokedById,
        action: "account.enforcement.revoked",
        targetKind: "account",
        targetId: targetUserId,
        reason: input.reason,
        correlationId: input.caseId ?? row.id,
        after: { enforcementId: row.id, kind: row.kind, state: row.state },
      });
    }
    return rows.map(mapAccountEnforcementToDTO);
  }
}

export const governanceEnforcementService = new GovernanceEnforcementService();

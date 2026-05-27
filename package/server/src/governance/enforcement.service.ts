import type {
  AccountEnforcementKind,
  CreateAccountEnforcementInput,
  UnblockAccountEnforcementInput,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { mapAccountEnforcementToDTO } from "./governance.mapper";
import type { GovernanceListOptions } from "./types";

const enforcementKindMap: Record<AccountEnforcementKind, any> = {
  warning: "WARNING",
  silence: "SILENCE",
  suspension: "SUSPENSION",
  ban: "BAN",
  rate_limit: "RATE_LIMIT",
  trust_restriction: "TRUST_RESTRICTION",
};

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
    metadata?: Record<string, unknown>;
  }) {
    const row = await prisma.accountEnforcement.create({
      data: {
        targetUserId: input.targetUserId,
        kind: enforcementKindMap[input.kind],
        reason: input.reason,
        safeMessage: input.safeMessage ?? null,
        decidedById: input.decidedById,
        decisionCode: input.decisionCode,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata as never,
      },
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

    const rows = await Promise.all(
      activeRows.map((row) =>
        prisma.accountEnforcement.update({
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
        }),
      ),
    );

    return rows.map(mapAccountEnforcementToDTO);
  }
}

export const governanceEnforcementService = new GovernanceEnforcementService();

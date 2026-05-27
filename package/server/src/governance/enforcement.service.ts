import type { AccountEnforcementKind } from "@rezics/contract";
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
      },
    });
    return mapAccountEnforcementToDTO(row);
  }
}

export const governanceEnforcementService = new GovernanceEnforcementService();

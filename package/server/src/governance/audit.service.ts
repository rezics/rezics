import { Prisma, prisma } from "#/prisma/client";
import { mapStaffAuditLogToDTO } from "./governance.mapper";
import type { GovernanceListOptions } from "./types";

export class GovernanceAuditService {
  async append(input: {
    actorUserId: string;
    action: string;
    targetKind: string;
    targetId: string;
    decisionCode: string;
    reason: string;
    requestId?: string | null;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const row = await prisma.staffAuditLog.create({
      data: {
        ...input,
        before: input.before as Prisma.InputJsonValue | undefined,
        after: input.after as Prisma.InputJsonValue | undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    return mapStaffAuditLogToDTO(row);
  }

  async list(options: GovernanceListOptions = {}) {
    const rows = await prisma.staffAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapStaffAuditLogToDTO);
  }
}

export const governanceAuditService = new GovernanceAuditService();

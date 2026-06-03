import type { StaffAuditLogDTO } from "@rezics/contract";
import { type Prisma, prisma } from "#/prisma/client";
import { mapStaffAuditLogToDTO } from "./governance.mapper";
import type { GovernanceAuditListOptions } from "./types";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(?:password|passcode|secret|token|credential|private[_-]?note|stack(?:trace)?|raw[_-]?credential)/i;

function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactAuditValue(nested),
    ]),
  );
}

function redactAuditMetadata(
  value: StaffAuditLogDTO["metadata"],
): StaffAuditLogDTO["metadata"] {
  return value === undefined
    ? undefined
    : (redactAuditValue(value) as StaffAuditLogDTO["metadata"]);
}

function redactStaffAuditLog(dto: StaffAuditLogDTO): StaffAuditLogDTO {
  return {
    ...dto,
    before: redactAuditMetadata(dto.before),
    after: redactAuditMetadata(dto.after),
    metadata: redactAuditMetadata(dto.metadata),
  };
}

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

  appendPrivilegedMutation(input: {
    actorUserId: string;
    action: string;
    targetKind: string;
    targetId: string;
    reason: string;
    correlationId: string;
    decisionCode?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    return this.append({
      actorUserId: input.actorUserId,
      action: input.action,
      targetKind: input.targetKind,
      targetId: input.targetId,
      decisionCode: input.decisionCode ?? "ALLOWED",
      reason: input.reason,
      requestId: input.correlationId,
      before: input.before,
      after: input.after,
      metadata: {
        ...(input.metadata ?? {}),
        correlationId: input.correlationId,
      },
    });
  }

  async list(options: GovernanceAuditListOptions = {}) {
    const rows = await prisma.staffAuditLog.findMany({
      where: {
        ...(options.actorUserId ? { actorUserId: options.actorUserId } : {}),
        ...(options.action ? { action: options.action } : {}),
        ...(options.targetKind ? { targetKind: options.targetKind } : {}),
        ...(options.targetId ? { targetId: options.targetId } : {}),
        ...(options.decisionCode ? { decisionCode: options.decisionCode } : {}),
        ...(options.requestId ? { requestId: options.requestId } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map((row) => redactStaffAuditLog(mapStaffAuditLogToDTO(row)));
  }

  async get(id: string) {
    const row = await prisma.staffAuditLog.findUnique({ where: { id } });
    return row ? redactStaffAuditLog(mapStaffAuditLogToDTO(row)) : null;
  }
}

export const governanceAuditService = new GovernanceAuditService();

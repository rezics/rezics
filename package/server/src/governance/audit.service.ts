import type { StaffAuditLogDTO } from "@rezics/contract";
import { and, desc, eq } from "drizzle-orm";
import { StaffAuditLog } from "../db/schema";
import { mapStaffAuditLogToDTO } from "./governance.mapper";
import type { GovernanceAuditListOptions } from "./types";

type StaffAuditLogRow = typeof StaffAuditLog.$inferSelect;

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
    metadata: redactAuditMetadata(dto.metadata),
  };
}

export interface GovernanceAuditRepository {
  create(input: {
    actorUserId: string;
    action: string;
    targetKind: string;
    targetId: string;
    decisionCode: string;
    reason: string;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<StaffAuditLogRow>;
  list(options: GovernanceAuditListOptions): Promise<StaffAuditLogRow[]>;
  get(id: string): Promise<StaffAuditLogRow | null>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleGovernanceAuditRepository(): GovernanceAuditRepository {
  return {
    async create(input) {
      const db = await getServerDb();
      const [row] = await db
        .insert(StaffAuditLog)
        .values({
          ...input,
          metadata: input.metadata,
        })
        .returning();
      if (!row) throw new Error("Failed to create StaffAuditLog");
      return row;
    },

    async list(options) {
      const db = await getServerDb();
      const filters = [
        options.actorUserId
          ? eq(StaffAuditLog.actorUserId, options.actorUserId)
          : undefined,
        options.action ? eq(StaffAuditLog.action, options.action) : undefined,
        options.targetKind
          ? eq(StaffAuditLog.targetKind, options.targetKind)
          : undefined,
        options.targetId
          ? eq(StaffAuditLog.targetId, options.targetId)
          : undefined,
        options.decisionCode
          ? eq(StaffAuditLog.decisionCode, options.decisionCode)
          : undefined,
        options.requestId
          ? eq(StaffAuditLog.requestId, options.requestId)
          : undefined,
      ].filter(Boolean);

      return db
        .select()
        .from(StaffAuditLog)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(StaffAuditLog.createdAt))
        .offset(options.offset ?? 0)
        .limit(options.limit ?? 50);
    },

    async get(id) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(StaffAuditLog)
        .where(eq(StaffAuditLog.id, id))
        .limit(1);
      return row ?? null;
    },
  };
}

const defaultRepository = createDrizzleGovernanceAuditRepository();

export class GovernanceAuditService {
  constructor(
    private readonly repository: GovernanceAuditRepository = defaultRepository,
  ) {}

  async append(input: {
    actorUserId: string;
    action: string;
    targetKind: string;
    targetId: string;
    decisionCode: string;
    reason: string;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const row = await this.repository.create(input);
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
      metadata: {
        ...(input.metadata ?? {}),
        correlationId: input.correlationId,
      },
    });
  }

  async list(options: GovernanceAuditListOptions = {}) {
    const rows = await this.repository.list(options);
    return rows.map((row) => redactStaffAuditLog(mapStaffAuditLogToDTO(row)));
  }

  async get(id: string) {
    const row = await this.repository.get(id);
    return row ? redactStaffAuditLog(mapStaffAuditLogToDTO(row)) : null;
  }
}

export const governanceAuditService = new GovernanceAuditService();

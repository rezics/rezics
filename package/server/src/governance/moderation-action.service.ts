import { and, desc, eq, inArray } from "drizzle-orm";
import type { ServerDb } from "../db/client";
import {
  ModerationAction,
  ModerationActionKind,
  ModerationActorKind,
  ModerationAuthority,
  ModerationStatus,
  ModerationTargetKind,
} from "../db/schema";

type ModerationActionCreateInput = {
  authority: (typeof ModerationAuthority.enumValues)[number];
  realmUnitId?: string | null;
  targetKind: (typeof ModerationTargetKind.enumValues)[number];
  targetId: string;
  targetPath?: string | null;
  actorKind?: (typeof ModerationActorKind.enumValues)[number];
  actorUserId?: string | null;
  actionKind: (typeof ModerationActionKind.enumValues)[number];
  resultingStatus?: (typeof ModerationStatus.enumValues)[number] | null;
  resultingLocked?: boolean | null;
  reasonCode: string;
  reasonText?: string | null;
  publicMessage?: string | null;
  caseId?: string | null;
  reversesActionId?: string | null;
  requestId?: string | null;
  idempotencyKey?: string | null;
  importedFrom?: string | null;
};

type ModerationActionRow = typeof ModerationAction.$inferSelect;
type ModerationActionDb = Pick<ServerDb, "select" | "insert">;
type ModerationTx = Pick<ServerDb, "select">;

type ModerationActionFieldRule = "forbidden" | "allowed" | "required";

type ModerationActionRule = {
  targets: readonly ModerationActionCreateInput["targetKind"][];
  resultingStatus: ModerationActionFieldRule;
  resultingLocked: ModerationActionFieldRule;
};

const allTargets = [
  "UNIT",
  "UNIT_REALM",
  "COMMENT",
  "UNIT_FIELD",
  "ACCOUNT",
  "REALM_MEMBER",
  "FEEDBACK",
] as const satisfies readonly ModerationActionCreateInput["targetKind"][];

const contentTargets = ["UNIT", "UNIT_REALM", "COMMENT"] as const;
const snapshotStatusRule = {
  targets: contentTargets,
  resultingStatus: "required",
  resultingLocked: "forbidden",
} as const satisfies ModerationActionRule;
const noSnapshotRule = (
  targets: readonly ModerationActionCreateInput["targetKind"][],
) =>
  ({
    targets,
    resultingStatus: "forbidden",
    resultingLocked: "forbidden",
  }) as const satisfies ModerationActionRule;
const lockRule = (
  targets: readonly ModerationActionCreateInput["targetKind"][],
) =>
  ({
    targets,
    resultingStatus: "forbidden",
    resultingLocked: "required",
  }) as const satisfies ModerationActionRule;

export const moderationActionRules = {
  APPROVE: snapshotStatusRule,
  REMOVE: snapshotStatusRule,
  RESTORE: snapshotStatusRule,
  LOCK: lockRule(contentTargets),
  UNLOCK: lockRule(contentTargets),
  FIELD_LOCK: lockRule(["UNIT_FIELD"] as const),
  FIELD_UNLOCK: lockRule(["UNIT_FIELD"] as const),
  WARNING: noSnapshotRule(["ACCOUNT"] as const),
  SILENCE: noSnapshotRule(["ACCOUNT"] as const),
  SUSPENSION: noSnapshotRule(["ACCOUNT"] as const),
  BAN: noSnapshotRule(["ACCOUNT"] as const),
  RATE_LIMIT: noSnapshotRule(["ACCOUNT"] as const),
  TRUST_RESTRICTION: noSnapshotRule(["ACCOUNT"] as const),
  REVOKE_ENFORCEMENT: noSnapshotRule(["ACCOUNT"] as const),
  MUTE_MEMBER: noSnapshotRule(["REALM_MEMBER"] as const),
  REMOVE_MEMBER: noSnapshotRule(["REALM_MEMBER"] as const),
  BAN_MEMBER: noSnapshotRule(["REALM_MEMBER"] as const),
  RESTORE_MEMBER: noSnapshotRule(["REALM_MEMBER"] as const),
  ESCALATE: noSnapshotRule(allTargets),
  REVERSE: noSnapshotRule(allTargets),
  NOTE: {
    targets: allTargets,
    resultingStatus: "allowed",
    resultingLocked: "allowed",
  },
} as const satisfies Record<
  ModerationActionCreateInput["actionKind"],
  ModerationActionRule
>;

function validateFieldRule(
  field: "resultingStatus" | "resultingLocked",
  rule: ModerationActionFieldRule,
  value: unknown,
  actionKind: ModerationActionCreateInput["actionKind"],
) {
  if (rule === "required" && value === undefined) {
    throw new Error(`${actionKind} requires ${field}`);
  }
  if (rule === "required" && value === null) {
    throw new Error(`${actionKind} requires ${field}`);
  }
  if (rule === "forbidden" && value !== undefined && value !== null) {
    throw new Error(`${actionKind} must not carry ${field}`);
  }
}

export function validateModerationActionInput(
  input: ModerationActionCreateInput,
) {
  const rule = moderationActionRules[input.actionKind];
  if (!(rule.targets as readonly string[]).includes(input.targetKind)) {
    throw new Error(
      `${input.actionKind} is not allowed for ${input.targetKind}`,
    );
  }
  validateFieldRule(
    "resultingStatus",
    rule.resultingStatus,
    input.resultingStatus,
    input.actionKind,
  );
  validateFieldRule(
    "resultingLocked",
    rule.resultingLocked,
    input.resultingLocked,
    input.actionKind,
  );
}

function actionData(input: ModerationActionCreateInput) {
  return {
    authority: input.authority,
    realmUnitId: input.realmUnitId ?? null,
    targetKind: input.targetKind,
    targetId: input.targetId,
    targetPath: input.targetPath ?? null,
    actorKind: input.actorKind ?? "USER",
    actorUserId: input.actorUserId ?? null,
    actionKind: input.actionKind,
    resultingStatus: input.resultingStatus ?? null,
    resultingLocked: input.resultingLocked ?? null,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText ?? null,
    publicMessage: input.publicMessage ?? null,
    caseId: input.caseId ?? null,
    reversesActionId: input.reversesActionId ?? null,
    requestId: input.requestId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    importedFrom: input.importedFrom ?? null,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

export class ModerationActionService {
  /**
   * Appends one moderation fact. `idempotencyKey` is request scoped; callers must
   * not derive it only from target+action because repeated cycles are valid.
   */
  async appendModerationAction(
    tx: ModerationActionDb,
    input: ModerationActionCreateInput,
  ) {
    validateModerationActionInput(input);

    if (input.idempotencyKey) {
      const [existing] = await tx
        .select()
        .from(ModerationAction)
        .where(eq(ModerationAction.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) return existing;
    }

    try {
      const [row] = await tx
        .insert(ModerationAction)
        .values(actionData(input))
        .returning();
      if (!row) throw new Error("Failed to append ModerationAction");
      return row;
    } catch (error) {
      if (input.idempotencyKey && isUniqueViolation(error)) {
        const [existing] = await tx
          .select()
          .from(ModerationAction)
          .where(eq(ModerationAction.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (existing) return existing;
      }
      throw error;
    }
  }

  latestActionFor(input: {
    targetKind: ModerationActionCreateInput["targetKind"];
    targetId: string;
  }) {
    return getServerDb().then((db) =>
      db
        .select()
        .from(ModerationAction)
        .where(
          and(
            eq(ModerationAction.targetKind, input.targetKind),
            eq(ModerationAction.targetId, input.targetId),
          ),
        )
        .orderBy(desc(ModerationAction.createdAt), desc(ModerationAction.id))
        .limit(1)
        .then(([row]) => row ?? null),
    );
  }

  async latestActionsFor(input: {
    targetKind: ModerationActionCreateInput["targetKind"];
    targetIds: string[];
    realmUnitId?: string | null;
  }) {
    const targetIds = [...new Set(input.targetIds)];
    if (targetIds.length === 0) return Promise.resolve([]);
    const db = await getServerDb();
    const filters = [
      eq(ModerationAction.targetKind, input.targetKind),
      inArray(ModerationAction.targetId, targetIds),
      input.realmUnitId
        ? eq(ModerationAction.realmUnitId, input.realmUnitId)
        : undefined,
    ].filter(Boolean);
    const rows = await db
      .select()
      .from(ModerationAction)
      .where(and(...filters))
      .orderBy(
        ModerationAction.targetKind,
        ModerationAction.targetId,
        desc(ModerationAction.createdAt),
        desc(ModerationAction.id),
      );
    const latest = new Map<string, ModerationActionRow>();
    for (const row of rows) {
      if (!latest.has(row.targetId)) latest.set(row.targetId, row);
    }
    return [...latest.values()];
  }

  /**
   * Latest effective remove is the newest REMOVE not reversed by a later
   * RESTORE/REVERSE action. Restore authority checks must run in the same
   * transaction as the snapshot update that depends on this answer.
   */
  async latestEffectiveRemoveFor(
    tx: ModerationTx,
    input: {
      targetKind: ModerationActionCreateInput["targetKind"];
      targetId: string;
    },
  ) {
    const removes = await tx
      .select()
      .from(ModerationAction)
      .where(
        and(
          eq(ModerationAction.targetKind, input.targetKind),
          eq(ModerationAction.targetId, input.targetId),
          eq(ModerationAction.actionKind, "REMOVE"),
        ),
      )
      .orderBy(desc(ModerationAction.createdAt), desc(ModerationAction.id))
      .limit(20);
    for (const remove of removes) {
      const [reversal] = await tx
        .select()
        .from(ModerationAction)
        .where(
          and(
            eq(ModerationAction.targetKind, input.targetKind),
            eq(ModerationAction.targetId, input.targetId),
            inArray(ModerationAction.actionKind, ["RESTORE", "REVERSE"]),
            eq(ModerationAction.reversesActionId, remove.id),
          ),
        )
        .orderBy(desc(ModerationAction.createdAt), desc(ModerationAction.id))
        .limit(1);
      if (!reversal) return remove;
    }
    return null;
  }
}

export const moderationActionService = new ModerationActionService();

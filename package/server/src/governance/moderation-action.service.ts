import { Prisma, prisma } from "#/prisma/client";

type ModerationActionCreateInput = {
  authority: Prisma.ModerationActionCreateInput["authority"];
  realmUnitId?: string | null;
  targetKind: Prisma.ModerationActionCreateInput["targetKind"];
  targetId: string;
  targetPath?: string | null;
  actorKind?: Prisma.ModerationActionCreateInput["actorKind"];
  actorUserId?: string | null;
  actionKind: Prisma.ModerationActionCreateInput["actionKind"];
  resultingStatus?:
    | Prisma.ModerationActionCreateInput["resultingStatus"]
    | null;
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

type ModerationActionAppendTx =
  | Pick<Prisma.TransactionClient, "moderationAction">
  | Pick<typeof prisma, "moderationAction">;
type ModerationTx = Prisma.TransactionClient | typeof prisma;

type ModerationActionFieldRule = "forbidden" | "allowed" | "required";

type ModerationActionRule = {
  targets: readonly Prisma.ModerationActionCreateInput["targetKind"][];
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
] as const satisfies readonly Prisma.ModerationActionCreateInput["targetKind"][];

const contentTargets = ["UNIT", "UNIT_REALM", "COMMENT"] as const;
const snapshotStatusRule = {
  targets: contentTargets,
  resultingStatus: "required",
  resultingLocked: "forbidden",
} as const satisfies ModerationActionRule;
const noSnapshotRule = (
  targets: readonly Prisma.ModerationActionCreateInput["targetKind"][],
) =>
  ({
    targets,
    resultingStatus: "forbidden",
    resultingLocked: "forbidden",
  }) as const satisfies ModerationActionRule;
const lockRule = (
  targets: readonly Prisma.ModerationActionCreateInput["targetKind"][],
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
  Prisma.ModerationActionCreateInput["actionKind"],
  ModerationActionRule
>;

function validateFieldRule(
  field: "resultingStatus" | "resultingLocked",
  rule: ModerationActionFieldRule,
  value: unknown,
  actionKind: Prisma.ModerationActionCreateInput["actionKind"],
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
  if (!rule.targets.includes(input.targetKind)) {
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

export class ModerationActionService {
  /**
   * Appends one moderation fact. `idempotencyKey` is request scoped; callers must
   * not derive it only from target+action because repeated cycles are valid.
   */
  async appendModerationAction(
    tx: ModerationActionAppendTx,
    input: ModerationActionCreateInput,
  ) {
    validateModerationActionInput(input);

    if (input.idempotencyKey) {
      const existing = await tx.moderationAction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    try {
      return await tx.moderationAction.create({ data: actionData(input) });
    } catch (error) {
      if (
        input.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await tx.moderationAction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  latestActionFor(input: {
    targetKind: Prisma.ModerationActionCreateInput["targetKind"];
    targetId: string;
  }) {
    return prisma.moderationAction.findFirst({
      where: input,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  latestActionsFor(input: {
    targetKind: Prisma.ModerationActionCreateInput["targetKind"];
    targetIds: string[];
    realmUnitId?: string | null;
  }) {
    const targetIds = [...new Set(input.targetIds)];
    if (targetIds.length === 0) return Promise.resolve([]);
    return prisma.moderationAction.findMany({
      distinct: ["targetKind", "targetId"],
      where: {
        targetKind: input.targetKind,
        targetId: { in: targetIds },
        ...(input.realmUnitId ? { realmUnitId: input.realmUnitId } : {}),
      },
      orderBy: [
        { targetKind: "asc" },
        { targetId: "asc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    });
  }

  /**
   * Latest effective remove is the newest REMOVE not reversed by a later
   * RESTORE/REVERSE action. Restore authority checks must run in the same
   * transaction as the snapshot update that depends on this answer.
   */
  async latestEffectiveRemoveFor(
    tx: ModerationTx,
    input: {
      targetKind: Prisma.ModerationActionCreateInput["targetKind"];
      targetId: string;
    },
  ) {
    const removes = await tx.moderationAction.findMany({
      where: { ...input, actionKind: "REMOVE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    });
    for (const remove of removes) {
      const reversal = await tx.moderationAction.findFirst({
        where: {
          ...input,
          actionKind: { in: ["RESTORE", "REVERSE"] },
          reversesActionId: remove.id,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (!reversal) return remove;
    }
    return null;
  }
}

export const moderationActionService = new ModerationActionService();

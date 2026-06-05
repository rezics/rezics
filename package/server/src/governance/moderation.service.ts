import type {
  ModerationOverlayDTO,
  ModerationStatus,
  ModerationTargetKind,
  RezicsSessionClaims,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import type { ServerDb } from "../db/client";
import {
  Comment,
  Feedback,
  ModerationAction,
  ModerationCase,
  Post,
  Unit,
  UnitCollaborator,
  UnitRealm,
} from "../db/schema";
import { mapUnitRealmToDTO } from "../realm/realm.mapper";
import {
  governanceCapabilityService,
  type GovernanceCapabilityService,
} from "./capability.service";
import {
  mapModerationActionToDTO,
  mapModerationCaseToDTO,
} from "./governance.mapper";
import {
  moderationActionService,
  type ModerationActionService,
} from "./moderation-action.service";
import type { GovernanceListOptions } from "./types";

type UnitModerationActionInput = "approve" | "remove" | "restore";
type CommentModerationActionInput = "remove" | "restore" | "lock" | "unlock";
type LockTargetKind = "POST" | "COMMENT" | "UNIT_REALM";
type ModerationTx = Pick<ServerDb, "select" | "insert" | "update" | "execute">;
type ModerationIdentity = Pick<RezicsSessionClaims, "userId" | "permission">;
type CommentModerationAuthority = "PLATFORM" | "REALM" | "OWNER";
type CommentModerationSubject = {
  id: string;
  rootUnitId: string;
  realmUnitId: string | null;
  rootUnit?: {
    userId: string | null;
    collaborators?: Array<{ userId: string; roleKey: string }>;
  } | null;
};

type ModerationDecisionInput = {
  moderatedUnitId: string;
  decidedById: string;
  reason: string;
  caseId?: string | null;
  metadata?: Record<string, unknown>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

type ModerationCaseStateValue = typeof ModerationCase.$inferSelect.state;
type ModerationScopeValue = typeof ModerationCase.$inferSelect.scope;
type ModerationTargetKindValue =
  typeof ModerationAction.$inferSelect.targetKind;
type ModerationStatusValue = typeof Unit.$inferSelect.moderationStatus;

type RealmCaseDecisionKind =
  | "approve_for_realm"
  | "reject_from_realm"
  | "hide_from_realm"
  | "remove_from_realm"
  | "lock"
  | "warn"
  | "mute_in_realm"
  | "remove_member"
  | "ban_from_realm"
  | "reject"
  | "duplicate"
  | "escalate";

const ownerCommentModerationRoles = new Set(["owner", "maintainer"]);
const realmCommentModerationCapabilities = new Set([
  "comment.moderate",
  "queue.realm.decide",
]);
const commentAuthorityRank = {
  OWNER: 1,
  REALM: 2,
  PLATFORM: 3,
} as const satisfies Record<CommentModerationAuthority, number>;

function upper<T extends string>(value: string): T {
  return value.toUpperCase() as T;
}

function lower<T extends string>(value: string): T {
  return value.toLowerCase() as T;
}

function cleanJsonObject(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

async function runModerationTransaction<T>(
  callback: (tx: ModerationTx) => Promise<T>,
): Promise<T> {
  const db = await getServerDb();
  return db.transaction((tx) => callback(tx as ModerationTx));
}

async function findModerationCaseById(tx: ModerationTx, id: string) {
  const [row] = await tx
    .select()
    .from(ModerationCase)
    .where(eq(ModerationCase.id, id))
    .limit(1);
  if (!row) throw new Error(`ModerationCase not found: ${id}`);
  return row;
}

async function firstModerationCaseByFeedback(input: {
  scope: ModerationScopeValue;
  feedbackId: string;
  realmUnitId?: string | null;
}) {
  const db = await getServerDb();
  const [row] = await db
    .select()
    .from(ModerationCase)
    .where(
      and(
        eq(ModerationCase.scope, input.scope),
        input.realmUnitId
          ? eq(ModerationCase.realmUnitId, input.realmUnitId)
          : undefined,
        eq(ModerationCase.sourceFeedbackId, input.feedbackId),
      ),
    )
    .orderBy(asc(ModerationCase.createdAt))
    .limit(1);
  return row ?? null;
}

async function findFeedbackById(feedbackId: string) {
  const db = await getServerDb();
  const [row] = await db
    .select()
    .from(Feedback)
    .where(eq(Feedback.id, feedbackId))
    .limit(1);
  if (!row) throw new Error(`Feedback not found: ${feedbackId}`);
  return row;
}

async function createModerationCase(
  tx: ModerationTx,
  data: Omit<typeof ModerationCase.$inferInsert, "updatedAt"> & {
    updatedAt?: Date;
  },
) {
  const [row] = await tx
    .insert(ModerationCase)
    .values({ ...data, updatedAt: data.updatedAt ?? new Date() })
    .returning();
  if (!row) throw new Error("Failed to create ModerationCase");
  return row;
}

async function updateModerationCase(
  tx: ModerationTx,
  id: string,
  data: Partial<typeof ModerationCase.$inferInsert>,
) {
  const [row] = await tx
    .update(ModerationCase)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(ModerationCase.id, id))
    .returning();
  if (!row) throw new Error(`ModerationCase not found: ${id}`);
  return row;
}

async function updateUnitModerationStatus(
  tx: ModerationTx,
  unitId: string,
  moderationStatus: ModerationStatusValue,
) {
  const [row] = await tx
    .update(Unit)
    .set({ moderationStatus, updatedAt: new Date() })
    .where(eq(Unit.id, unitId))
    .returning();
  if (!row) throw new Error(`Unit not found: ${unitId}`);
  return row;
}

async function updateUnitRealm(
  tx: ModerationTx,
  input: {
    realmUnitId: string;
    unitId: string;
    moderationStatus?: ModerationStatusValue;
    isLocked?: boolean;
  },
) {
  const [row] = await tx
    .update(UnitRealm)
    .set({
      ...(input.moderationStatus
        ? { moderationStatus: input.moderationStatus }
        : {}),
      ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
    })
    .where(
      and(
        eq(UnitRealm.realmUnitId, input.realmUnitId),
        eq(UnitRealm.unitId, input.unitId),
      ),
    )
    .returning();
  if (!row) {
    throw new Error(
      `UnitRealm not found: ${input.realmUnitId}/${input.unitId}`,
    );
  }
  return row;
}

async function updatePostLock(
  tx: ModerationTx,
  unitId: string,
  isLocked: boolean,
) {
  const [row] = await tx
    .update(Post)
    .set({ isLocked, updatedAt: new Date() })
    .where(eq(Post.unitId, unitId))
    .returning();
  if (!row) throw new Error(`Post not found: ${unitId}`);
  return row;
}

async function updateCommentSnapshot(
  tx: ModerationTx,
  commentId: string,
  data: {
    moderationStatus?: typeof Comment.$inferSelect.moderationStatus;
    isLocked?: boolean;
  },
) {
  const [row] = await tx
    .update(Comment)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(Comment.id, commentId))
    .returning();
  if (!row) throw new Error(`Comment not found: ${commentId}`);
  return row;
}

async function findCommentForModeration(
  tx: ModerationTx,
  commentId: string,
  actorUserId: string,
): Promise<CommentModerationSubject> {
  await tx.execute(sql`
    SELECT "id" FROM "Comment"
    WHERE "id" = ${commentId}::uuid
    FOR UPDATE
  `);

  const [comment] = await tx
    .select()
    .from(Comment)
    .where(eq(Comment.id, commentId))
    .limit(1);
  if (!comment) throw new Error(`Comment not found: ${commentId}`);

  const [rootUnit] = await tx
    .select({ userId: Unit.userId })
    .from(Unit)
    .where(eq(Unit.id, comment.rootUnitId))
    .limit(1);
  const collaborators = await tx
    .select({
      userId: UnitCollaborator.userId,
      roleKey: UnitCollaborator.roleKey,
    })
    .from(UnitCollaborator)
    .where(
      and(
        eq(UnitCollaborator.unitId, comment.rootUnitId),
        eq(UnitCollaborator.userId, actorUserId),
      ),
    );

  return {
    id: comment.id,
    rootUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId,
    rootUnit: rootUnit
      ? {
          userId: rootUnit.userId,
          collaborators,
        }
      : null,
  };
}

function notifyModeration(input: {
  kind:
    | "moderation.report.updated"
    | "moderation.subject.warning"
    | "moderation.case.assigned"
    | "moderation.appeal.updated"
    | "moderation.escalation.updated";
  recipientUserId?: string | null;
  sourceUnitId?: string | null;
  actorUserId?: string | null;
  extra?: Record<string, unknown>;
}) {
  if (!input.recipientUserId || !input.sourceUnitId) return;
  broadcast({
    kind: input.kind,
    sourceUnitId: input.sourceUnitId,
    directRecipients: [input.recipientUserId],
    actorId: input.actorUserId ?? null,
    extra: input.extra,
  }).catch(() => {});
}

function enqueueModeratedContentSearch(moderatedUnitId: string) {
  return Promise.all([
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentSync,
        { unitId: moderatedUnitId },
        { type: "server", service: "governance" },
      ),
    ),
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postSync,
        { postId: moderatedUnitId },
        { type: "server", service: "governance" },
      ),
    ),
  ]);
}

function enqueueRealmMembershipSearch(contentUnitId: string) {
  return Promise.all([
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentPatchRealmIds,
        { unitId: contentUnitId },
        { type: "server", service: "governance" },
      ),
    ),
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postSync,
        { postId: contentUnitId },
        { type: "server", service: "governance" },
      ),
    ),
  ]);
}

function enqueueCommentSearch(commentId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.commentSync,
      { commentId },
      { type: "server", service: "governance" },
    ),
  );
}

function snapshotStatusFromAction(
  action: UnitModerationActionInput,
): "APPROVED" | "REMOVED" {
  return action === "remove" ? "REMOVED" : "APPROVED";
}

function actionKindFromAction(
  action: UnitModerationActionInput,
): "APPROVE" | "REMOVE" | "RESTORE" {
  if (action === "approve") return "APPROVE";
  if (action === "restore") return "RESTORE";
  return "REMOVE";
}

function commentActionKindFromAction(
  action: CommentModerationActionInput,
): "REMOVE" | "RESTORE" | "LOCK" | "UNLOCK" {
  if (action === "restore") return "RESTORE";
  if (action === "lock") return "LOCK";
  if (action === "unlock") return "UNLOCK";
  return "REMOVE";
}

function caseStateForDecision(kind: RealmCaseDecisionKind) {
  if (kind === "reject_from_realm" || kind === "reject") return "REJECTED";
  if (kind === "duplicate") return "DUPLICATE";
  if (kind === "escalate") return "ESCALATED";
  return "ACTIONED";
}

export class GovernanceModerationService {
  constructor(
    private readonly actions: ModerationActionService = moderationActionService,
    private readonly capabilities: GovernanceCapabilityService = governanceCapabilityService,
  ) {}

  async listCases(options: GovernanceListOptions = {}) {
    const db = await getServerDb();
    const rows = await db
      .select()
      .from(ModerationCase)
      .where(
        and(
          options.scope
            ? eq(
                ModerationCase.scope,
                upper<ModerationScopeValue>(options.scope),
              )
            : undefined,
          options.state
            ? eq(
                ModerationCase.state,
                upper<ModerationCaseStateValue>(options.state),
              )
            : undefined,
        ),
      )
      .orderBy(desc(ModerationCase.createdAt))
      .offset(options.offset ?? 0)
      .limit(options.limit ?? 50);
    return rows.map(mapModerationCaseToDTO);
  }

  async getCase(caseId: string) {
    const db = await getServerDb();
    const [row] = await db
      .select()
      .from(ModerationCase)
      .where(eq(ModerationCase.id, caseId))
      .limit(1);
    if (!row) throw new Error(`ModerationCase not found: ${caseId}`);
    return mapModerationCaseToDTO(row);
  }

  async listCaseActions(caseId: string, options: GovernanceListOptions = {}) {
    const db = await getServerDb();
    const rows = await db
      .select()
      .from(ModerationAction)
      .where(eq(ModerationAction.caseId, caseId))
      .orderBy(asc(ModerationAction.createdAt), asc(ModerationAction.id))
      .offset(options.offset ?? 0)
      .limit(options.limit ?? 50);
    return rows.map(mapModerationActionToDTO);
  }

  async listTargetActions(
    targetKind: ModerationTargetKindValue,
    targetId: string,
    options: GovernanceListOptions = {},
  ) {
    const db = await getServerDb();
    const rows = await db
      .select()
      .from(ModerationAction)
      .where(
        and(
          eq(ModerationAction.targetKind, targetKind),
          eq(ModerationAction.targetId, targetId),
        ),
      )
      .orderBy(asc(ModerationAction.createdAt), asc(ModerationAction.id))
      .offset(options.offset ?? 0)
      .limit(options.limit ?? 50);
    return rows.map(mapModerationActionToDTO);
  }

  async listModerationOverlays(input: {
    targetKind: ModerationTargetKind;
    targetIds: string[];
    realmUnitId?: string | null;
  }): Promise<ModerationOverlayDTO[]> {
    const ids = [...new Set(input.targetIds)].slice(0, 200);
    if (ids.length === 0) return [];

    const dbTargetKind = upper<ModerationTargetKindValue>(input.targetKind);
    const [snapshots, latestActions] = await Promise.all([
      this.overlaySnapshots(input.targetKind, ids, input.realmUnitId),
      this.actions.latestActionsFor({
        targetKind: dbTargetKind,
        targetIds: ids,
        realmUnitId:
          input.targetKind === "unit_realm" ? input.realmUnitId : null,
      }),
    ]);
    const latestByTargetId = new Map(
      latestActions.map((action) => [action.targetId, action]),
    );

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      moderationStatus: lower<ModerationStatus>(snapshot.moderationStatus),
      latestAction: latestByTargetId.has(snapshot.id)
        ? mapModerationActionToDTO(latestByTargetId.get(snapshot.id)!)
        : null,
    }));
  }

  async resolveCommentModerationAuthority(
    identity: ModerationIdentity,
    comment: CommentModerationSubject,
  ): Promise<CommentModerationAuthority | null> {
    const platformHints = await this.capabilities.resolveHintsForIdentity({
      userId: identity.userId,
      permission: identity.permission,
    });
    if (
      platformHints.some(
        (hint) =>
          hint.capability === "comment.moderate" &&
          hint.scope.kind === "global",
      )
    ) {
      return "PLATFORM";
    }

    if (comment.realmUnitId) {
      const membership = await this.capabilities.realmMembershipForPolicy(
        comment.realmUnitId,
        identity.userId,
      );
      if (
        membership?.capabilities.some(
          (hint) =>
            hint.scope.kind === "realm" &&
            hint.scope.realmUnitId === comment.realmUnitId &&
            realmCommentModerationCapabilities.has(hint.capability),
        )
      ) {
        return "REALM";
      }
    }

    const rootUnit =
      comment.rootUnit ??
      (await this.getRootUnitOwnerSubject(comment.rootUnitId, identity.userId));

    if (rootUnit?.userId === identity.userId) return "OWNER";
    if (
      rootUnit?.collaborators?.some(
        (collaborator) =>
          collaborator.userId === identity.userId &&
          ownerCommentModerationRoles.has(collaborator.roleKey),
      )
    ) {
      return "OWNER";
    }

    return null;
  }

  async moderateComment(input: {
    commentId: string;
    actorUserId: string;
    identity: ModerationIdentity;
    action: CommentModerationActionInput;
    reasonCode: string;
    reasonText?: string | null;
    publicMessage?: string | null;
    caseId?: string | null;
    requestId?: string | null;
    idempotencyKey?: string | null;
  }) {
    if (input.actorUserId !== input.identity.userId) {
      throw new Error("Comment moderation actor must match identity");
    }

    const row = await runModerationTransaction(async (tx) => {
      const comment = await findCommentForModeration(
        tx,
        input.commentId,
        input.actorUserId,
      );
      const authority = await this.resolveCommentModerationAuthority(
        input.identity,
        comment,
      );
      if (!authority) {
        throw new Error("Forbidden: insufficient comment moderation authority");
      }

      let reversesActionId: string | null = null;
      if (input.action === "restore") {
        const latestRemove = await this.actions.latestEffectiveRemoveFor(tx, {
          targetKind: "COMMENT",
          targetId: input.commentId,
        });
        if (
          latestRemove &&
          commentAuthorityRank[authority] <
            commentAuthorityRank[latestRemove.authority]
        ) {
          throw new Error(
            "Forbidden: cannot restore a comment removed by higher authority",
          );
        }
        reversesActionId = latestRemove?.id ?? null;
      }

      const resultingStatus =
        input.action === "remove"
          ? "REMOVED"
          : input.action === "restore"
            ? "APPROVED"
            : undefined;
      const resultingLocked =
        input.action === "lock"
          ? true
          : input.action === "unlock"
            ? false
            : undefined;

      const updated = await updateCommentSnapshot(tx, input.commentId, {
        ...(resultingStatus ? { moderationStatus: resultingStatus } : {}),
        ...(resultingLocked !== undefined ? { isLocked: resultingLocked } : {}),
      });
      await this.actions.appendModerationAction(tx, {
        authority,
        realmUnitId: authority === "REALM" ? comment.realmUnitId : null,
        targetKind: "COMMENT",
        targetId: input.commentId,
        actorKind: "USER",
        actorUserId: input.actorUserId,
        actionKind: commentActionKindFromAction(input.action),
        resultingStatus,
        resultingLocked,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        publicMessage: input.publicMessage,
        caseId: input.caseId,
        reversesActionId,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
      });
      return updated;
    });

    await enqueueCommentSearch(input.commentId);
    return row;
  }

  private async overlaySnapshots(
    targetKind: ModerationTargetKind,
    ids: string[],
    realmUnitId?: string | null,
  ): Promise<Array<{ id: string; moderationStatus: ModerationStatusValue }>> {
    const db = await getServerDb();
    switch (targetKind) {
      case "unit":
        return db
          .select({ id: Unit.id, moderationStatus: Unit.moderationStatus })
          .from(Unit)
          .where(inArray(Unit.id, ids));
      case "unit_realm":
        if (!realmUnitId) {
          throw new Error("unit_realm moderation overlays require realmUnitId");
        }
        return db
          .select({
            id: UnitRealm.unitId,
            moderationStatus: UnitRealm.moderationStatus,
          })
          .from(UnitRealm)
          .where(
            and(
              eq(UnitRealm.realmUnitId, realmUnitId),
              inArray(UnitRealm.unitId, ids),
            ),
          );
      case "comment":
        return db
          .select({
            id: Comment.id,
            moderationStatus: Comment.moderationStatus,
          })
          .from(Comment)
          .where(inArray(Comment.id, ids));
      default:
        throw new Error(
          `Moderation overlays require a snapshot-backed target kind: ${targetKind}`,
        );
    }
  }

  private async getRootUnitOwnerSubject(
    rootUnitId: string,
    identityUserId: string,
  ): Promise<NonNullable<CommentModerationSubject["rootUnit"]> | null> {
    const db = await getServerDb();
    const [unit] = await db
      .select({ userId: Unit.userId })
      .from(Unit)
      .where(eq(Unit.id, rootUnitId))
      .limit(1);
    if (!unit) return null;
    const collaborators = await db
      .select({
        userId: UnitCollaborator.userId,
        roleKey: UnitCollaborator.roleKey,
      })
      .from(UnitCollaborator)
      .where(
        and(
          eq(UnitCollaborator.unitId, rootUnitId),
          eq(UnitCollaborator.userId, identityUserId),
        ),
      );
    return {
      userId: unit.userId,
      collaborators,
    };
  }

  private appendNote(
    tx: ModerationTx,
    input: {
      caseId: string;
      actorUserId: string;
      targetKind: ModerationTargetKindValue;
      targetId: string;
      realmUnitId?: string | null;
      reasonCode: string;
      reasonText?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.actions.appendModerationAction(tx, {
      authority: input.realmUnitId ? "REALM" : "PLATFORM",
      realmUnitId: input.realmUnitId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      actorKind: "USER",
      actorUserId: input.actorUserId,
      actionKind: "NOTE",
      reasonCode: input.reasonCode,
      reasonText: input.reasonText ?? null,
      caseId: input.caseId,
      importedFrom: input.metadata ? "legacy-workflow-metadata" : null,
    });
  }

  async createCaseFromFeedback(input: {
    feedbackId: string;
    actorUserId: string;
    severity?: string | null;
    reason?: string | null;
    safeSummary?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await firstModerationCaseByFeedback({
      scope: "PLATFORM",
      feedbackId: input.feedbackId,
    });
    if (existing) return mapModerationCaseToDTO(existing);

    const feedback = await findFeedbackById(input.feedbackId);
    const targetKind = feedback.targetKind ?? "FEEDBACK";
    const targetId = feedback.targetId ?? feedback.id;

    const row = await runModerationTransaction(async (tx) => {
      const created = await createModerationCase(tx, {
        scope: "PLATFORM",
        state: "NEW",
        severity: input.severity ?? null,
        reporterUserId: feedback.userId,
        targetKind,
        targetId,
        addressedUnitId: feedback.addressedUnitId ?? null,
        sourceFeedbackId: feedback.id,
        reason: input.reason ?? feedback.content,
        safeSummary: input.safeSummary ?? null,
        metadata: cleanJsonObject({
          ...(input.metadata ?? {}),
          feedbackUrl: feedback.url ?? undefined,
          feedbackType: feedback.type,
        }),
      });
      await this.appendNote(tx, {
        caseId: created.id,
        actorUserId: input.actorUserId,
        targetKind,
        targetId,
        reasonCode: "case.created_from_report",
        reasonText: input.reason ?? feedback.content,
        metadata: input.metadata,
      });
      return created;
    });

    notifyModeration({
      kind: "moderation.report.updated",
      recipientUserId: row.reporterUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { caseId: row.id, state: row.state },
    });
    return mapModerationCaseToDTO(row);
  }

  async duplicateCase(input: {
    caseId: string;
    duplicateOfCaseId: string;
    actorUserId: string;
    reason: string;
  }) {
    const row = await runModerationTransaction(async (tx) => {
      const updated = await updateModerationCase(tx, input.caseId, {
        state: "DUPLICATE",
        duplicateOfCaseId: input.duplicateOfCaseId,
        reason: input.reason,
      });
      await this.appendNote(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        targetKind: updated.targetKind,
        targetId: updated.targetId,
        realmUnitId: updated.realmUnitId,
        reasonCode: "case.duplicate_linked",
        reasonText: input.reason,
      });
      return updated;
    });
    return mapModerationCaseToDTO(row);
  }

  async assignCase(input: {
    caseId: string;
    actorUserId: string;
    assignedToUserId: string | null;
    reason?: string | null;
  }) {
    const row = await runModerationTransaction(async (tx) => {
      const current = await findModerationCaseById(tx, input.caseId);
      const updated = await updateModerationCase(tx, input.caseId, {
        state: input.assignedToUserId ? "ASSIGNED" : current.state,
        assignedToUserId: input.assignedToUserId,
      });
      await this.appendNote(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        targetKind: updated.targetKind,
        targetId: updated.targetId,
        realmUnitId: updated.realmUnitId,
        reasonCode: "case.assigned",
        reasonText: input.reason,
      });
      return updated;
    });
    notifyModeration({
      kind: "moderation.case.assigned",
      recipientUserId: row.assignedToUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { caseId: row.id, state: row.state },
    });
    return mapModerationCaseToDTO(row);
  }

  async triageCase(input: {
    caseId: string;
    actorUserId: string;
    severity?: string | null;
    assignedToUserId?: string | null;
    reason?: string | null;
    safeSummary?: string | null;
  }) {
    const row = await runModerationTransaction(async (tx) => {
      const current = await findModerationCaseById(tx, input.caseId);
      const updated = await updateModerationCase(tx, input.caseId, {
        state: "TRIAGED",
        severity: input.severity ?? current.severity,
        assignedToUserId:
          input.assignedToUserId === undefined
            ? current.assignedToUserId
            : input.assignedToUserId,
        reason: input.reason ?? current.reason,
        safeSummary: input.safeSummary ?? current.safeSummary,
      });
      await this.appendNote(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        targetKind: updated.targetKind,
        targetId: updated.targetId,
        realmUnitId: updated.realmUnitId,
        reasonCode: "case.triaged",
        reasonText: input.reason,
      });
      return updated;
    });
    return mapModerationCaseToDTO(row);
  }

  async decideCase(input: {
    caseId: string;
    actorUserId: string;
    state: "actioned" | "resolved" | "rejected";
    reason: string;
    decision?: Record<string, unknown>;
  }) {
    const row = await runModerationTransaction(async (tx) => {
      const updated = await updateModerationCase(tx, input.caseId, {
        state: upper(input.state),
        reason: input.reason,
      });
      await this.appendNote(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        targetKind: updated.targetKind,
        targetId: updated.targetId,
        realmUnitId: updated.realmUnitId,
        reasonCode: (input.decision?.code as string | undefined) ?? "ALLOWED",
        reasonText: input.reason,
        metadata: input.decision,
      });
      return updated;
    });
    notifyModeration({
      kind: "moderation.report.updated",
      recipientUserId: row.reporterUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { caseId: row.id, state: row.state },
    });
    return mapModerationCaseToDTO(row);
  }

  async appealCase(input: {
    caseId: string;
    actorUserId: string;
    reason: string;
  }) {
    const row = await runModerationTransaction(async (tx) => {
      const updated = await updateModerationCase(tx, input.caseId, {
        state: "NEW",
      });
      await this.appendNote(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        targetKind: updated.targetKind,
        targetId: updated.targetId,
        realmUnitId: updated.realmUnitId,
        reasonCode: "case.appeal_requested",
        reasonText: input.reason,
      });
      return updated;
    });
    notifyModeration({
      kind: "moderation.appeal.updated",
      recipientUserId: row.reporterUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { caseId: row.id, state: row.state },
    });
    return mapModerationCaseToDTO(row);
  }

  async listRealmCases(
    realmUnitId: string,
    options: GovernanceListOptions = {},
  ) {
    const db = await getServerDb();
    const rows = await db
      .select()
      .from(ModerationCase)
      .where(
        and(
          eq(ModerationCase.scope, "REALM"),
          eq(ModerationCase.realmUnitId, realmUnitId),
        ),
      )
      .orderBy(desc(ModerationCase.createdAt))
      .offset(options.offset ?? 0)
      .limit(options.limit ?? 50);
    return rows.map(mapModerationCaseToDTO);
  }

  async listEscalatedRealmCases(options: GovernanceListOptions = {}) {
    const db = await getServerDb();
    const rows = await db
      .select()
      .from(ModerationCase)
      .where(
        and(
          eq(ModerationCase.scope, "REALM"),
          eq(ModerationCase.state, "ESCALATED"),
        ),
      )
      .orderBy(desc(ModerationCase.updatedAt))
      .offset(options.offset ?? 0)
      .limit(options.limit ?? 50);
    return rows.map(mapModerationCaseToDTO);
  }

  async listRealmCaseActions(
    realmUnitId: string,
    caseId: string,
    options: GovernanceListOptions = {},
  ) {
    void realmUnitId;
    return this.listCaseActions(caseId, options);
  }

  async createRealmCase(input: {
    realmUnitId: string;
    actorUserId: string;
    reporterUserId?: string | null;
    subjectUserId?: string | null;
    targetKind: string;
    targetId: string;
    addressedUnitId?: string | null;
    sourceFeedbackId?: string | null;
    assignedToUserId?: string | null;
    reason?: string | null;
    safeSummary?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const targetKind = upper<ModerationTargetKindValue>(input.targetKind);
    const row = await runModerationTransaction(async (tx) => {
      const created = await createModerationCase(tx, {
        scope: "REALM",
        realmUnitId: input.realmUnitId,
        state: "NEW",
        reporterUserId: input.reporterUserId ?? null,
        subjectUserId: input.subjectUserId ?? null,
        targetKind,
        targetId: input.targetId,
        addressedUnitId: input.addressedUnitId ?? null,
        sourceFeedbackId: input.sourceFeedbackId ?? null,
        assignedToUserId: input.assignedToUserId ?? null,
        reason: input.reason ?? null,
        safeSummary: input.safeSummary ?? null,
        metadata: cleanJsonObject(input.metadata),
      });
      await this.appendNote(tx, {
        caseId: created.id,
        actorUserId: input.actorUserId,
        targetKind,
        targetId: input.targetId,
        realmUnitId: input.realmUnitId,
        reasonCode: "realm_case.created",
        reasonText: input.reason,
      });
      return created;
    });
    return mapModerationCaseToDTO(row);
  }

  async createRealmCaseFromFeedback(input: {
    realmUnitId: string;
    feedbackId: string;
    actorUserId: string;
    assignedToUserId?: string | null;
    reason?: string | null;
    safeSummary?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await firstModerationCaseByFeedback({
      scope: "REALM",
      realmUnitId: input.realmUnitId,
      feedbackId: input.feedbackId,
    });
    if (existing) return mapModerationCaseToDTO(existing);

    const feedback = await findFeedbackById(input.feedbackId);
    return this.createRealmCase({
      realmUnitId: input.realmUnitId,
      actorUserId: input.actorUserId,
      reporterUserId: feedback.userId,
      targetKind: (feedback.targetKind ?? "FEEDBACK").toLowerCase(),
      targetId: feedback.targetId ?? feedback.id,
      addressedUnitId: feedback.addressedUnitId ?? null,
      sourceFeedbackId: feedback.id,
      assignedToUserId: input.assignedToUserId,
      reason: input.reason ?? feedback.content,
      safeSummary: input.safeSummary,
      metadata: {
        ...(input.metadata ?? {}),
        feedbackType: feedback.type,
        feedbackUrl: feedback.url ?? undefined,
      },
    });
  }

  async decideRealmCase(input: {
    realmUnitId: string;
    caseId: string;
    actorUserId: string;
    decisionKind: RealmCaseDecisionKind;
    reason: string;
    duplicateOfCaseId?: string | null;
    parentCaseId?: string | null;
    decision?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const row = await runModerationTransaction(async (tx) => {
      const current = await findModerationCaseById(tx, input.caseId);
      const updated = await updateModerationCase(tx, input.caseId, {
        state: caseStateForDecision(input.decisionKind),
        parentCaseId: input.parentCaseId ?? current.parentCaseId,
        reason: input.reason,
        metadata: cleanJsonObject({
          ...(current.metadata &&
          typeof current.metadata === "object" &&
          !Array.isArray(current.metadata)
            ? current.metadata
            : {}),
          ...(input.metadata ?? {}),
          duplicateOfCaseId: input.duplicateOfCaseId ?? undefined,
        }),
      });

      if (
        input.decisionKind === "approve_for_realm" ||
        input.decisionKind === "reject_from_realm" ||
        input.decisionKind === "remove_from_realm"
      ) {
        await this.setRealmUnitModerationStatusInTx(tx, {
          realmUnitId: input.realmUnitId,
          unitId: current.addressedUnitId ?? current.targetId,
          actorUserId: input.actorUserId,
          action:
            input.decisionKind === "approve_for_realm" ? "approve" : "remove",
          reasonCode:
            (input.decision?.code as string | undefined) ??
            `realm.${input.decisionKind}`,
          reasonText: input.reason,
          caseId: current.id,
        });
      }

      if (input.decisionKind === "lock" && current.addressedUnitId) {
        await this.setLockInTx(tx, {
          targetKind: "UNIT_REALM",
          targetId: current.addressedUnitId,
          realmUnitId: input.realmUnitId,
          isLocked: true,
          actorUserId: input.actorUserId,
          reasonCode: "realm.lock",
          reasonText: input.reason,
          caseId: current.id,
        });
      }

      await this.appendNote(tx, {
        caseId: current.id,
        actorUserId: input.actorUserId,
        targetKind: current.targetKind,
        targetId: current.targetId,
        realmUnitId: input.realmUnitId,
        reasonCode:
          (input.decision?.code as string | undefined) ?? input.decisionKind,
        reasonText: input.reason,
        metadata: input.decision,
      });
      return updated;
    });

    if (
      input.decisionKind === "remove_from_realm" ||
      input.decisionKind === "approve_for_realm" ||
      input.decisionKind === "reject_from_realm"
    ) {
      const contentUnitId = row.addressedUnitId;
      if (contentUnitId) await enqueueRealmMembershipSearch(contentUnitId);
    }
    return mapModerationCaseToDTO(row);
  }

  async escalateRealmCase(input: {
    realmUnitId: string;
    caseId: string;
    actorUserId: string;
    reason: string;
    platformCaseId?: string | null;
    safeSummary?: string | null;
  }) {
    const row = await runModerationTransaction(async (tx) => {
      const realmCase = await findModerationCaseById(tx, input.caseId);
      let platformCaseId = input.platformCaseId ?? realmCase.parentCaseId;
      if (!platformCaseId) {
        const platformCase = await createModerationCase(tx, {
          scope: "PLATFORM",
          state: "ESCALATED",
          reporterUserId: realmCase.reporterUserId,
          subjectUserId: realmCase.subjectUserId,
          targetKind: realmCase.targetKind,
          targetId: realmCase.targetId,
          addressedUnitId: realmCase.addressedUnitId,
          realmUnitId: input.realmUnitId,
          sourceFeedbackId: realmCase.sourceFeedbackId,
          reason: input.reason,
          safeSummary: input.safeSummary ?? realmCase.safeSummary,
          metadata: cleanJsonObject({
            escalatedFromRealmCaseId: realmCase.id,
          }),
        });
        platformCaseId = platformCase.id;
        await this.appendNote(tx, {
          caseId: platformCase.id,
          actorUserId: input.actorUserId,
          targetKind: platformCase.targetKind,
          targetId: platformCase.targetId,
          realmUnitId: input.realmUnitId,
          reasonCode: "case.escalated_from_realm_case",
          reasonText: input.reason,
        });
      }
      const updated = await updateModerationCase(tx, input.caseId, {
        state: "ESCALATED",
        parentCaseId: platformCaseId,
        reason: input.reason,
        safeSummary: input.safeSummary ?? realmCase.safeSummary,
      });
      await this.actions.appendModerationAction(tx, {
        authority: "REALM",
        realmUnitId: input.realmUnitId,
        targetKind: realmCase.targetKind,
        targetId: realmCase.targetId,
        actorKind: "USER",
        actorUserId: input.actorUserId,
        actionKind: "ESCALATE",
        reasonCode: "realm.case.escalated",
        reasonText: input.reason,
        caseId: realmCase.id,
      });
      return updated;
    });
    notifyModeration({
      kind: "moderation.escalation.updated",
      recipientUserId: row.reporterUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { caseId: row.id, parentCaseId: row.parentCaseId },
    });
    return mapModerationCaseToDTO(row);
  }

  async setUnitModerationStatus(input: {
    unitId: string;
    actorUserId: string;
    action: UnitModerationActionInput;
    reasonCode: string;
    reasonText?: string | null;
    caseId?: string | null;
    requestId?: string | null;
    idempotencyKey?: string | null;
  }) {
    const row = await runModerationTransaction(async (tx) =>
      this.setUnitModerationStatusInTx(tx, input),
    );
    await enqueueModeratedContentSearch(input.unitId);
    return row;
  }

  private async setUnitModerationStatusInTx(
    tx: ModerationTx,
    input: {
      unitId: string;
      actorUserId: string;
      action: UnitModerationActionInput;
      reasonCode: string;
      reasonText?: string | null;
      caseId?: string | null;
      requestId?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
    const resultingStatus = snapshotStatusFromAction(input.action);
    const unit = await updateUnitModerationStatus(
      tx,
      input.unitId,
      resultingStatus,
    );
    await this.actions.appendModerationAction(tx, {
      authority: "PLATFORM",
      targetKind: "UNIT",
      targetId: input.unitId,
      actorKind: "USER",
      actorUserId: input.actorUserId,
      actionKind: actionKindFromAction(input.action),
      resultingStatus,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
      caseId: input.caseId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
    });
    return unit;
  }

  async listRealmUnitStates(input: { realmUnitId: string; unitIds: string[] }) {
    const unitIds = [...new Set(input.unitIds)];
    if (unitIds.length === 0) return [];

    const db = await getServerDb();
    const rows = await db
      .select()
      .from(UnitRealm)
      .where(
        and(
          eq(UnitRealm.realmUnitId, input.realmUnitId),
          inArray(UnitRealm.unitId, unitIds),
        ),
      )
      .orderBy(desc(UnitRealm.createdAt));
    return rows.map(mapUnitRealmToDTO);
  }

  async setRealmUnitModerationStatus(input: {
    realmUnitId: string;
    unitId: string;
    actorUserId: string;
    action: UnitModerationActionInput;
    reasonCode: string;
    reasonText?: string | null;
    caseId?: string | null;
    requestId?: string | null;
    idempotencyKey?: string | null;
  }) {
    const row = await runModerationTransaction(async (tx) =>
      this.setRealmUnitModerationStatusInTx(tx, input),
    );
    await enqueueRealmMembershipSearch(input.unitId);
    return mapUnitRealmToDTO(row);
  }

  private async setRealmUnitModerationStatusInTx(
    tx: ModerationTx,
    input: {
      realmUnitId: string;
      unitId: string;
      actorUserId: string;
      action: UnitModerationActionInput;
      reasonCode: string;
      reasonText?: string | null;
      caseId?: string | null;
      requestId?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
    const resultingStatus = snapshotStatusFromAction(input.action);
    const row = await updateUnitRealm(tx, {
      realmUnitId: input.realmUnitId,
      unitId: input.unitId,
      moderationStatus: resultingStatus,
    });
    await this.actions.appendModerationAction(tx, {
      authority: "REALM",
      realmUnitId: input.realmUnitId,
      targetKind: "UNIT_REALM",
      targetId: input.unitId,
      actorKind: "USER",
      actorUserId: input.actorUserId,
      actionKind: actionKindFromAction(input.action),
      resultingStatus,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
      caseId: input.caseId,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
    });
    return row;
  }

  async setLock(input: {
    targetKind: LockTargetKind;
    targetId: string;
    realmUnitId?: string | null;
    isLocked: boolean;
    actorUserId: string;
    reasonCode: string;
    reasonText?: string | null;
    caseId?: string | null;
  }) {
    return runModerationTransaction((tx) => this.setLockInTx(tx, input));
  }

  private async setLockInTx(
    tx: ModerationTx,
    input: {
      targetKind: LockTargetKind;
      targetId: string;
      realmUnitId?: string | null;
      isLocked: boolean;
      actorUserId: string;
      reasonCode: string;
      reasonText?: string | null;
      caseId?: string | null;
    },
  ) {
    if (input.targetKind === "POST") {
      await updatePostLock(tx, input.targetId, input.isLocked);
    } else if (input.targetKind === "COMMENT") {
      await updateCommentSnapshot(tx, input.targetId, {
        isLocked: input.isLocked,
      });
    } else if (input.realmUnitId) {
      await updateUnitRealm(tx, {
        realmUnitId: input.realmUnitId,
        unitId: input.targetId,
        isLocked: input.isLocked,
      });
    }
    return this.actions.appendModerationAction(tx, {
      authority: input.realmUnitId ? "REALM" : "PLATFORM",
      realmUnitId: input.realmUnitId,
      targetKind:
        input.targetKind === "POST"
          ? "UNIT"
          : input.targetKind === "COMMENT"
            ? "COMMENT"
            : "UNIT_REALM",
      targetId: input.targetId,
      actorKind: "USER",
      actorUserId: input.actorUserId,
      actionKind: input.isLocked ? "LOCK" : "UNLOCK",
      resultingLocked: input.isLocked,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText,
      caseId: input.caseId,
    });
  }

  async requestOwnerDelegation(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.createRealmCase({
      realmUnitId: input.realmUnitId,
      actorUserId: input.decidedById,
      targetKind: "unit",
      targetId: input.moderatedUnitId,
      addressedUnitId: input.moderatedUnitId,
      assignedToUserId: input.decidedById,
      reason: input.reason,
      metadata: {
        ...(input.metadata ?? {}),
        ownerDelegation: true,
      },
    });
  }
}

export const governanceModerationService = new GovernanceModerationService();

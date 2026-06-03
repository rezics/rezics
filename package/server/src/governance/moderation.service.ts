import type {
  ModerationOverlayDTO,
  ModerationStatus,
  ModerationTargetKind,
  RezicsSessionClaims,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { Prisma, prisma } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
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

type ModerationStatusInput = "approved" | "pending" | "removed";
type UnitModerationActionInput = "approve" | "remove" | "restore";
type CommentModerationActionInput = "remove" | "restore" | "lock" | "unlock";
type LockTargetKind = "POST" | "COMMENT" | "UNIT_REALM";
type ModerationTx = Prisma.TransactionClient;
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

type ContentModerationStateInput = {
  moderatedUnitId: string;
  state: "visible" | "hidden" | "tombstoned" | "removed";
  decidedById?: string | null;
  caseId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

type RealmUnitModerationStateInput = ModerationDecisionInput & {
  realmUnitId: string;
  state: "pending_review" | "approved" | "rejected" | "removed";
};

type RealmQueueDecisionKind =
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
): Prisma.InputJsonObject | undefined {
  if (!input) return undefined;
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Prisma.InputJsonObject;
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

function stateFromContentState(
  state: ContentModerationStateInput["state"],
): UnitModerationActionInput {
  return state === "visible" ? "restore" : "remove";
}

function realmStatusFromLegacyState(
  state: RealmUnitModerationStateInput["state"],
): ModerationStatusInput {
  if (state === "pending_review") return "pending";
  if (state === "approved") return "approved";
  return "removed";
}

function caseStateForDecision(kind: RealmQueueDecisionKind) {
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
    const rows = await prisma.moderationCase.findMany({
      orderBy: { createdAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapModerationCaseToDTO);
  }

  async getCase(caseId: string) {
    const row = await prisma.moderationCase.findUniqueOrThrow({
      where: { id: caseId },
    });
    return mapModerationCaseToDTO(row);
  }

  async listCaseEvents(caseId: string, options: GovernanceListOptions = {}) {
    return this.listCaseActions(caseId, options);
  }

  async listCaseActions(caseId: string, options: GovernanceListOptions = {}) {
    const rows = await prisma.moderationAction.findMany({
      where: { caseId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapModerationActionToDTO);
  }

  async listTargetActions(
    targetKind: Prisma.ModerationTargetKind,
    targetId: string,
    options: GovernanceListOptions = {},
  ) {
    const rows = await prisma.moderationAction.findMany({
      where: { targetKind, targetId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapModerationActionToDTO);
  }

  async listModerationOverlays(input: {
    targetKind: ModerationTargetKind;
    targetIds: string[];
    realmUnitId?: string | null;
  }): Promise<ModerationOverlayDTO[]> {
    const ids = [...new Set(input.targetIds)].slice(0, 200);
    if (ids.length === 0) return [];

    const prismaTargetKind = upper<Prisma.ModerationTargetKind>(
      input.targetKind,
    );
    const [snapshots, latestActions] = await Promise.all([
      this.overlaySnapshots(input.targetKind, ids, input.realmUnitId),
      this.actions.latestActionsFor({
        targetKind: prismaTargetKind,
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
      (await prisma.unit.findUnique({
        where: { id: comment.rootUnitId },
        select: {
          userId: true,
          collaborators: {
            where: { userId: identity.userId },
            select: { userId: true, roleKey: true },
          },
        },
      }));

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

    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "Comment"
        WHERE "id" = ${input.commentId}::uuid
        FOR UPDATE
      `;
      const comment = await tx.comment.findUniqueOrThrow({
        where: { id: input.commentId },
        include: {
          rootUnit: {
            select: {
              userId: true,
              collaborators: {
                where: { userId: input.actorUserId },
                select: { userId: true, roleKey: true },
              },
            },
          },
        },
      });
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

      const updated = await tx.comment.update({
        where: { id: input.commentId },
        data: {
          ...(resultingStatus ? { moderationStatus: resultingStatus } : {}),
          ...(resultingLocked !== undefined
            ? { isLocked: resultingLocked }
            : {}),
        },
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
  ): Promise<Array<{ id: string; moderationStatus: Prisma.ModerationStatus }>> {
    switch (targetKind) {
      case "unit":
        return prisma.unit.findMany({
          where: { id: { in: ids } },
          select: { id: true, moderationStatus: true },
        });
      case "unit_realm":
        if (!realmUnitId) {
          throw new Error("unit_realm moderation overlays require realmUnitId");
        }
        return prisma.unitRealm
          .findMany({
            where: { realmUnitId, unitId: { in: ids } },
            select: { unitId: true, moderationStatus: true },
          })
          .then((rows) =>
            rows.map((row) => ({
              id: row.unitId,
              moderationStatus: row.moderationStatus,
            })),
          );
      case "comment":
        return prisma.comment.findMany({
          where: { id: { in: ids } },
          select: { id: true, moderationStatus: true },
        });
      default:
        throw new Error(
          `Moderation overlays require a snapshot-backed target kind: ${targetKind}`,
        );
    }
  }

  private appendNote(
    tx: ModerationTx,
    input: {
      caseId: string;
      actorUserId: string;
      targetKind: Prisma.ModerationTargetKind;
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
    const existing = await prisma.moderationCase.findFirst({
      where: { sourceFeedbackId: input.feedbackId, scope: "PLATFORM" },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return mapModerationCaseToDTO(existing);

    const feedback = await prisma.feedback.findUniqueOrThrow({
      where: { id: input.feedbackId },
    });
    const targetKind = feedback.targetKind ?? "FEEDBACK";
    const targetId = feedback.targetId ?? feedback.id;

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.moderationCase.create({
        data: {
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
        },
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
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: "DUPLICATE",
          duplicateOfCaseId: input.duplicateOfCaseId,
          reason: input.reason,
        },
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
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: input.assignedToUserId ? "ASSIGNED" : current.state,
          assignedToUserId: input.assignedToUserId,
        },
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
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: "TRIAGED",
          severity: input.severity ?? current.severity,
          assignedToUserId:
            input.assignedToUserId === undefined
              ? current.assignedToUserId
              : input.assignedToUserId,
          reason: input.reason ?? current.reason,
          safeSummary: input.safeSummary ?? current.safeSummary,
        },
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
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: upper(input.state),
          reason: input.reason,
        },
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
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: { state: "NEW" },
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

  async listRealmQueue(
    realmUnitId: string,
    options: GovernanceListOptions = {},
  ) {
    const rows = await prisma.moderationCase.findMany({
      where: { scope: "REALM", realmUnitId },
      orderBy: { createdAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapModerationCaseToDTO);
  }

  async listEscalatedRealmQueue(options: GovernanceListOptions = {}) {
    const rows = await prisma.moderationCase.findMany({
      where: { scope: "REALM", state: "ESCALATED" },
      orderBy: { updatedAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapModerationCaseToDTO);
  }

  async listRealmQueueEvents(
    realmUnitId: string,
    queueItemId: string,
    options: GovernanceListOptions = {},
  ) {
    void realmUnitId;
    return this.listCaseActions(queueItemId, options);
  }

  async createRealmQueueItem(input: {
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
    const targetKind = upper<Prisma.ModerationTargetKind>(input.targetKind);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.moderationCase.create({
        data: {
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
        },
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

  async createRealmQueueItemFromFeedback(input: {
    realmUnitId: string;
    feedbackId: string;
    actorUserId: string;
    assignedToUserId?: string | null;
    reason?: string | null;
    safeSummary?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await prisma.moderationCase.findFirst({
      where: {
        scope: "REALM",
        realmUnitId: input.realmUnitId,
        sourceFeedbackId: input.feedbackId,
      },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return mapModerationCaseToDTO(existing);

    const feedback = await prisma.feedback.findUniqueOrThrow({
      where: { id: input.feedbackId },
    });
    return this.createRealmQueueItem({
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

  async decideRealmQueueItem(input: {
    realmUnitId: string;
    queueItemId: string;
    actorUserId: string;
    decisionKind: RealmQueueDecisionKind;
    reason: string;
    duplicateOfQueueItemId?: string | null;
    linkedCaseId?: string | null;
    decision?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.queueItemId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.queueItemId },
        data: {
          state: caseStateForDecision(input.decisionKind),
          parentCaseId: input.linkedCaseId ?? current.parentCaseId,
          reason: input.reason,
          metadata: cleanJsonObject({
            ...(current.metadata &&
            typeof current.metadata === "object" &&
            !Array.isArray(current.metadata)
              ? current.metadata
              : {}),
            ...(input.metadata ?? {}),
            duplicateOfQueueItemId: input.duplicateOfQueueItemId ?? undefined,
          }),
        },
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

  async escalateRealmQueueItem(input: {
    realmUnitId: string;
    queueItemId: string;
    actorUserId: string;
    reason: string;
    caseId?: string | null;
    safeSummary?: string | null;
  }) {
    const row = await prisma.$transaction(async (tx) => {
      const realmCase = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.queueItemId },
      });
      let platformCaseId = input.caseId ?? realmCase.parentCaseId;
      if (!platformCaseId) {
        const platformCase = await tx.moderationCase.create({
          data: {
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
          },
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
      const updated = await tx.moderationCase.update({
        where: { id: input.queueItemId },
        data: {
          state: "ESCALATED",
          parentCaseId: platformCaseId,
          reason: input.reason,
          safeSummary: input.safeSummary ?? realmCase.safeSummary,
        },
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

  async getGlobalContentState(moderatedUnitId: string) {
    const row = await prisma.unit.findUnique({
      where: { id: moderatedUnitId },
      select: {
        id: true,
        moderationStatus: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!row) return null;
    return {
      moderatedUnitId: row.id,
      state: row.moderationStatus === "REMOVED" ? "removed" : "visible",
      decidedByUserId: null,
      caseId: null,
      reason: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listGlobalContentStates(moderatedUnitIds: string[]) {
    const ids = [...new Set(moderatedUnitIds)];
    if (ids.length === 0) return [];
    const rows = await prisma.unit.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        moderationStatus: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      moderatedUnitId: row.id,
      state: row.moderationStatus === "REMOVED" ? "removed" : "visible",
      decidedByUserId: null,
      caseId: null,
      reason: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
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
    const row = await prisma.$transaction(async (tx) =>
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
    const unit = await tx.unit.update({
      where: { id: input.unitId },
      data: { moderationStatus: resultingStatus },
    });
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

  async setGlobalContentState(input: ContentModerationStateInput) {
    const unit = await this.setUnitModerationStatus({
      unitId: input.moderatedUnitId,
      actorUserId: input.decidedById ?? "",
      action: stateFromContentState(input.state),
      reasonCode: input.state,
      reasonText: input.reason,
      caseId: input.caseId,
    });
    return {
      moderatedUnitId: unit.id,
      state: unit.moderationStatus === "REMOVED" ? "removed" : "visible",
      decidedByUserId: input.decidedById ?? null,
      caseId: input.caseId ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata,
      createdAt: unit.createdAt.toISOString(),
      updatedAt: unit.updatedAt.toISOString(),
    };
  }

  async hideGlobal(input: ModerationDecisionInput) {
    return this.setGlobalContentState({ ...input, state: "hidden" });
  }

  async tombstoneGlobal(input: ModerationDecisionInput) {
    return this.setGlobalContentState({ ...input, state: "tombstoned" });
  }

  async restoreGlobal(input: ModerationDecisionInput) {
    return this.setGlobalContentState({ ...input, state: "visible" });
  }

  async listRealmUnitStates(input: { realmUnitId: string; unitIds: string[] }) {
    const unitIds = [...new Set(input.unitIds)];
    if (unitIds.length === 0) return [];

    const rows = await prisma.unitRealm.findMany({
      where: {
        realmUnitId: input.realmUnitId,
        unitId: { in: unitIds },
      },
      orderBy: { createdAt: "desc" },
    });
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
    const row = await prisma.$transaction(async (tx) =>
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
    const row = await tx.unitRealm.update({
      where: {
        realmUnitId_unitId: {
          realmUnitId: input.realmUnitId,
          unitId: input.unitId,
        },
      },
      data: { moderationStatus: resultingStatus },
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

  async setRealmUnitVisibilityState(
    input: ContentModerationStateInput & { realmUnitId: string },
  ) {
    return this.setRealmUnitModerationStatus({
      realmUnitId: input.realmUnitId,
      unitId: input.moderatedUnitId,
      actorUserId: input.decidedById ?? "",
      action: stateFromContentState(input.state),
      reasonCode: input.state,
      reasonText: input.reason,
      caseId: input.caseId,
    });
  }

  async hideInRealm(input: ModerationDecisionInput & { realmUnitId: string }) {
    return this.setRealmUnitVisibilityState({ ...input, state: "hidden" });
  }

  async tombstoneInRealm(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.setRealmUnitVisibilityState({ ...input, state: "tombstoned" });
  }

  async restoreInRealm(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.setRealmUnitVisibilityState({ ...input, state: "visible" });
  }

  async setRealmUnitModerationState(input: RealmUnitModerationStateInput) {
    const status = realmStatusFromLegacyState(input.state);
    return this.setRealmUnitModerationStatus({
      realmUnitId: input.realmUnitId,
      unitId: input.moderatedUnitId,
      actorUserId: input.decidedById,
      action: status === "removed" ? "remove" : "approve",
      reasonCode: input.state,
      reasonText: input.reason,
      caseId: input.caseId,
    });
  }

  async approveInRealm(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.setRealmUnitModerationState({ ...input, state: "approved" });
  }

  async rejectInRealm(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.setRealmUnitModerationState({ ...input, state: "rejected" });
  }

  async removeFromRealm(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.setRealmUnitModerationState({ ...input, state: "removed" });
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
    return prisma.$transaction((tx) => this.setLockInTx(tx, input));
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
      await tx.post.update({
        where: { unitId: input.targetId },
        data: { isLocked: input.isLocked },
      });
    } else if (input.targetKind === "COMMENT") {
      await tx.comment.update({
        where: { id: input.targetId },
        data: { isLocked: input.isLocked },
      });
    } else if (input.realmUnitId) {
      await tx.unitRealm.update({
        where: {
          realmUnitId_unitId: {
            realmUnitId: input.realmUnitId,
            unitId: input.targetId,
          },
        },
        data: { isLocked: input.isLocked },
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
    return this.createRealmQueueItem({
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

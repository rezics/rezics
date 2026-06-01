import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { Prisma, prisma } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { AppError } from "../utils/errors";
import { governanceAuditService } from "./audit.service";
import {
  mapContentModerationStateToDTO,
  mapModerationCaseEventToDTO,
  mapModerationCaseToDTO,
  mapRealmContentModerationToDTO,
  mapRealmModerationEventToDTO,
  mapRealmQueueItemToDTO,
} from "./governance.mapper";
import type { GovernanceListOptions } from "./types";

type ContentModerationStateInput = {
  moderatedUnitId: string;
  state: "visible" | "hidden" | "tombstoned" | "locked" | "archived";
  decidedById?: string | null;
  caseId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

type ModerationDecisionInput = {
  moderatedUnitId: string;
  decidedById: string;
  reason: string;
  caseId?: string | null;
  metadata?: Record<string, unknown>;
};

type CaseEventInput = {
  caseId: string;
  actorUserId: string;
  eventType: string;
  reason?: string | null;
  decision?: Record<string, unknown> | null;
  decisionCode?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reversible?: boolean;
};

type RealmQueueDecisionKind =
  | "hide_from_realm"
  | "remove_from_feed"
  | "lock"
  | "archive"
  | "warn"
  | "mute_in_realm"
  | "remove_member"
  | "ban_from_realm"
  | "reject"
  | "duplicate"
  | "escalate";

function toPrismaState(input: ContentModerationStateInput["state"]) {
  return input.toUpperCase() as Uppercase<ContentModerationStateInput["state"]>;
}

function cleanJsonObject(
  input: Record<string, unknown>,
): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Prisma.InputJsonObject;
}

function jsonOrUndefined(
  input: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (input === undefined) return undefined;
  if (input === null) return Prisma.JsonNull;
  return cleanJsonObject(input);
}

function contentModerationData(input: ContentModerationStateInput) {
  return {
    state: toPrismaState(input.state),
    decidedById: input.decidedById ?? null,
    caseId: input.caseId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata as never,
  };
}

function contentModerationEventType(input: {
  state: ContentModerationStateInput["state"];
  realmUnitId?: string | null;
}) {
  const prefix = input.realmUnitId ? "realm_content" : "content";
  if (input.state === "visible") return `${prefix}.restored`;
  if (input.state === "hidden") return `${prefix}.hidden`;
  if (input.state === "tombstoned") return `${prefix}.tombstoned`;
  return `${prefix}.state_changed`;
}

function contentModerationEventSummary(input: {
  state?: string | null;
  reason?: string | null;
  moderatedUnitId: string;
  realmUnitId?: string | null;
}) {
  return cleanJsonObject({
    state: input.state,
    reason: input.reason,
    moderatedUnitId: input.moderatedUnitId,
    realmUnitId: input.realmUnitId ?? undefined,
  });
}

function realmQueueStateForDecision(kind: RealmQueueDecisionKind) {
  if (kind === "reject") return "REJECTED";
  if (kind === "duplicate") return "DUPLICATE";
  if (kind === "escalate") return "ESCALATED";
  return "ACTIONED";
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

function auditPrivilegedMutation(
  input: Parameters<typeof governanceAuditService.appendPrivilegedMutation>[0],
) {
  governanceAuditService.appendPrivilegedMutation(input).catch(() => {});
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

export class GovernanceModerationService {
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
    const rows = await prisma.moderationCaseEvent.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapModerationCaseEventToDTO);
  }

  private async createCaseEvent(tx: any, input: CaseEventInput) {
    return tx.moderationCaseEvent.create({
      data: {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        eventType: input.eventType,
        reason: input.reason ?? null,
        decision: jsonOrUndefined(input.decision),
        decisionCode: input.decisionCode ?? null,
        before: jsonOrUndefined(input.before),
        after: jsonOrUndefined(input.after),
        reversible: input.reversible ?? false,
      },
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
      where: { sourceFeedbackId: input.feedbackId },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return mapModerationCaseToDTO(existing);

    const feedback = await prisma.feedback.findUniqueOrThrow({
      where: { id: input.feedbackId },
    });

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.moderationCase.create({
        data: {
          state: "NEW",
          severity: input.severity ?? null,
          reporterUserId: feedback.userId,
          targetKind: feedback.unitId ? "unit" : "feedback",
          targetId: feedback.unitId ?? feedback.id,
          addressedUnitId: feedback.unitId ?? null,
          sourceFeedbackId: feedback.id,
          reason: input.reason ?? feedback.content ?? null,
          safeSummary: input.safeSummary ?? null,
          metadata: cleanJsonObject({
            ...(input.metadata ?? {}),
            feedbackUrl: feedback.url ?? undefined,
            feedbackType: feedback.type,
          }),
        },
      });
      await this.createCaseEvent(tx, {
        caseId: created.id,
        actorUserId: input.actorUserId,
        eventType: "case.created_from_report",
        reason: input.reason ?? feedback.content ?? null,
        after: {
          sourceFeedbackId: feedback.id,
          addressedUnitId: feedback.unitId,
        },
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
      const before = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: "DUPLICATE",
          duplicateOfCaseId: input.duplicateOfCaseId,
          reason: input.reason,
        },
      });
      await this.createCaseEvent(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        eventType: "case.duplicate_linked",
        reason: input.reason,
        before: {
          state: before.state,
          duplicateOfCaseId: before.duplicateOfCaseId,
        },
        after: {
          state: updated.state,
          duplicateOfCaseId: updated.duplicateOfCaseId,
        },
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
      const before = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: input.assignedToUserId ? "ASSIGNED" : before.state,
          assignedToUserId: input.assignedToUserId,
        },
      });
      await this.createCaseEvent(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        eventType: "case.assigned",
        reason: input.reason ?? null,
        before: {
          assignedToUserId: before.assignedToUserId,
          state: before.state,
        },
        after: {
          assignedToUserId: updated.assignedToUserId,
          state: updated.state,
        },
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
    auditPrivilegedMutation({
      actorUserId: input.actorUserId,
      action: "moderation.case.assigned",
      targetKind: "moderation-case",
      targetId: row.id,
      reason: input.reason ?? "case assignment changed",
      correlationId: row.id,
      after: { assignedToUserId: row.assignedToUserId, state: row.state },
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
      const before = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: "TRIAGED",
          severity: input.severity ?? before.severity,
          assignedToUserId:
            input.assignedToUserId === undefined
              ? before.assignedToUserId
              : input.assignedToUserId,
          reason: input.reason ?? before.reason,
          safeSummary: input.safeSummary ?? before.safeSummary,
        },
      });
      await this.createCaseEvent(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        eventType: "case.triaged",
        reason: input.reason ?? null,
        before: {
          state: before.state,
          severity: before.severity,
          assignedToUserId: before.assignedToUserId,
        },
        after: {
          state: updated.state,
          severity: updated.severity,
          assignedToUserId: updated.assignedToUserId,
        },
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
    const nextState = input.state.toUpperCase() as
      | "ACTIONED"
      | "RESOLVED"
      | "REJECTED";
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: {
          state: nextState,
          reason: input.reason,
        },
      });
      await this.createCaseEvent(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        eventType: "case.decided",
        reason: input.reason,
        decision: input.decision ?? null,
        decisionCode: (input.decision?.code as string | undefined) ?? "ALLOWED",
        reversible: nextState === "ACTIONED",
        before: { state: before.state },
        after: { state: updated.state },
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
    auditPrivilegedMutation({
      actorUserId: input.actorUserId,
      action: "moderation.case.decided",
      targetKind: "moderation-case",
      targetId: row.id,
      decisionCode: (input.decision?.code as string | undefined) ?? "ALLOWED",
      reason: input.reason,
      correlationId: row.id,
      after: { state: row.state },
    });
    return mapModerationCaseToDTO(row);
  }

  async appealCase(input: {
    caseId: string;
    actorUserId: string;
    reason: string;
  }) {
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.moderationCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const updated = await tx.moderationCase.update({
        where: { id: input.caseId },
        data: { state: "NEW" },
      });
      await this.createCaseEvent(tx, {
        caseId: input.caseId,
        actorUserId: input.actorUserId,
        eventType: "case.appeal_requested",
        reason: input.reason,
        before: { state: before.state },
        after: { state: updated.state },
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
    auditPrivilegedMutation({
      actorUserId: input.actorUserId,
      action: "moderation.case.appeal_requested",
      targetKind: "moderation-case",
      targetId: row.id,
      reason: input.reason,
      correlationId: row.id,
      after: { state: row.state },
    });
    return mapModerationCaseToDTO(row);
  }

  async listRealmQueue(
    realmUnitId: string,
    options: GovernanceListOptions = {},
  ) {
    const rows = await prisma.realmModerationQueueItem.findMany({
      where: { realmUnitId },
      orderBy: { createdAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapRealmQueueItemToDTO);
  }

  async listEscalatedRealmQueue(options: GovernanceListOptions = {}) {
    const rows = await prisma.realmModerationQueueItem.findMany({
      where: { state: "ESCALATED" },
      orderBy: { updatedAt: "desc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapRealmQueueItemToDTO);
  }

  async listRealmQueueEvents(
    realmUnitId: string,
    queueItemId: string,
    options: GovernanceListOptions = {},
  ) {
    const rows = await prisma.realmModerationEvent.findMany({
      where: { realmUnitId, queueItemId },
      orderBy: { createdAt: "asc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 50,
    });
    return rows.map(mapRealmModerationEventToDTO);
  }

  private async createRealmQueueEvent(
    tx: any,
    input: {
      queueItemId: string;
      realmUnitId: string;
      actorUserId: string;
      decisionKind?: RealmQueueDecisionKind | null;
      decision?: Record<string, unknown> | null;
      decisionCode?: string | null;
      reason?: string | null;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
    },
  ) {
    return tx.realmModerationEvent.create({
      data: {
        queueItemId: input.queueItemId,
        realmUnitId: input.realmUnitId,
        actorUserId: input.actorUserId,
        decisionKind: input.decisionKind ?? null,
        decision: jsonOrUndefined(input.decision),
        decisionCode: input.decisionCode ?? null,
        reason: input.reason ?? null,
        before: jsonOrUndefined(input.before),
        after: jsonOrUndefined(input.after),
      },
    });
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
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.realmModerationQueueItem.create({
        data: {
          realmUnitId: input.realmUnitId,
          state: "NEW",
          reporterUserId: input.reporterUserId ?? null,
          subjectUserId: input.subjectUserId ?? null,
          targetKind: input.targetKind,
          targetId: input.targetId,
          addressedUnitId: input.addressedUnitId ?? null,
          sourceFeedbackId: input.sourceFeedbackId ?? null,
          assignedToUserId: input.assignedToUserId ?? null,
          reason: input.reason ?? null,
          safeSummary: input.safeSummary ?? null,
          metadata: (input.metadata ?? undefined) as never,
        },
      });
      await this.createRealmQueueEvent(tx, {
        queueItemId: created.id,
        realmUnitId: input.realmUnitId,
        actorUserId: input.actorUserId,
        reason: input.reason ?? null,
        after: {
          state: created.state,
          targetKind: created.targetKind,
          targetId: created.targetId,
          addressedUnitId: created.addressedUnitId,
        },
      });
      return created;
    });
    notifyModeration({
      kind: "moderation.report.updated",
      recipientUserId: row.reporterUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { queueItemId: row.id, state: row.state },
    });
    return mapRealmQueueItemToDTO(row);
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
    const existing = await prisma.realmModerationQueueItem.findFirst({
      where: {
        realmUnitId: input.realmUnitId,
        sourceFeedbackId: input.feedbackId,
      },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return mapRealmQueueItemToDTO(existing);

    const feedback = await prisma.feedback.findUniqueOrThrow({
      where: { id: input.feedbackId },
    });
    return this.createRealmQueueItem({
      realmUnitId: input.realmUnitId,
      actorUserId: input.actorUserId,
      reporterUserId: feedback.userId,
      targetKind: feedback.unitId ? "unit" : "feedback",
      targetId: feedback.unitId ?? feedback.id,
      addressedUnitId: feedback.unitId ?? null,
      sourceFeedbackId: feedback.id,
      assignedToUserId: input.assignedToUserId,
      reason: input.reason ?? feedback.content ?? null,
      safeSummary: input.safeSummary,
      metadata: cleanJsonObject({
        ...(input.metadata ?? {}),
        feedbackType: feedback.type,
        feedbackUrl: feedback.url ?? undefined,
      }),
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
      const before = await tx.realmModerationQueueItem.findUniqueOrThrow({
        where: { id: input.queueItemId },
      });
      const nextState = realmQueueStateForDecision(input.decisionKind);
      const updated = await tx.realmModerationQueueItem.update({
        where: { id: input.queueItemId },
        data: {
          state: nextState,
          linkedCaseId: input.linkedCaseId ?? before.linkedCaseId,
          reason: input.reason,
          metadata: cleanJsonObject({
            ...(before.metadata &&
            typeof before.metadata === "object" &&
            !Array.isArray(before.metadata)
              ? before.metadata
              : {}),
            ...(input.metadata ?? {}),
            duplicateOfQueueItemId: input.duplicateOfQueueItemId ?? undefined,
          }) as never,
        },
      });

      if (input.decisionKind === "hide_from_realm" && before.addressedUnitId) {
        await tx.realmContentModeration.upsert({
          where: {
            realmUnitId_moderatedUnitId: {
              realmUnitId: input.realmUnitId,
              moderatedUnitId: before.addressedUnitId,
            },
          },
          create: {
            realmUnitId: input.realmUnitId,
            moderatedUnitId: before.addressedUnitId,
            state: "HIDDEN",
            decidedById: input.actorUserId,
            reason: input.reason,
          },
          update: {
            state: "HIDDEN",
            decidedById: input.actorUserId,
            reason: input.reason,
          },
        });
      }
      if (input.decisionKind === "lock" && before.addressedUnitId) {
        await tx.realmContentModeration.upsert({
          where: {
            realmUnitId_moderatedUnitId: {
              realmUnitId: input.realmUnitId,
              moderatedUnitId: before.addressedUnitId,
            },
          },
          create: {
            realmUnitId: input.realmUnitId,
            moderatedUnitId: before.addressedUnitId,
            state: "LOCKED",
            decidedById: input.actorUserId,
            reason: input.reason,
          },
          update: {
            state: "LOCKED",
            decidedById: input.actorUserId,
            reason: input.reason,
          },
        });
      }
      if (input.decisionKind === "archive" && before.addressedUnitId) {
        await tx.realmContentModeration.upsert({
          where: {
            realmUnitId_moderatedUnitId: {
              realmUnitId: input.realmUnitId,
              moderatedUnitId: before.addressedUnitId,
            },
          },
          create: {
            realmUnitId: input.realmUnitId,
            moderatedUnitId: before.addressedUnitId,
            state: "ARCHIVED",
            decidedById: input.actorUserId,
            reason: input.reason,
          },
          update: {
            state: "ARCHIVED",
            decidedById: input.actorUserId,
            reason: input.reason,
          },
        });
      }
      if (input.decisionKind === "remove_from_feed" && before.addressedUnitId) {
        await tx.unitRealm.delete({
          where: {
            realmUnitId_unitId: {
              realmUnitId: input.realmUnitId,
              unitId: before.addressedUnitId,
            },
          },
        });
      }
      if (
        (input.decisionKind === "remove_member" ||
          input.decisionKind === "ban_from_realm") &&
        before.subjectUserId
      ) {
        await tx.realmMember.delete({
          where: {
            realmUnitId_userId: {
              realmUnitId: input.realmUnitId,
              userId: before.subjectUserId,
            },
          },
        });
      }

      await this.createRealmQueueEvent(tx, {
        queueItemId: input.queueItemId,
        realmUnitId: input.realmUnitId,
        actorUserId: input.actorUserId,
        decisionKind: input.decisionKind,
        decision: input.decision ?? null,
        decisionCode: (input.decision?.code as string | undefined) ?? "ALLOWED",
        reason: input.reason,
        before: {
          state: before.state,
          linkedCaseId: before.linkedCaseId,
        },
        after: {
          state: updated.state,
          linkedCaseId: updated.linkedCaseId,
          duplicateOfQueueItemId: input.duplicateOfQueueItemId ?? undefined,
        },
      });
      return updated;
    });
    if (input.decisionKind === "remove_from_feed") {
      const contentUnitId = row.addressedUnitId;
      if (contentUnitId) await enqueueRealmMembershipSearch(contentUnitId);
    }
    notifyModeration({
      kind: "moderation.report.updated",
      recipientUserId: row.reporterUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { queueItemId: row.id, state: row.state },
    });
    if (input.decisionKind === "warn") {
      notifyModeration({
        kind: "moderation.subject.warning",
        recipientUserId: row.subjectUserId,
        sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
        actorUserId: input.actorUserId,
        extra: { queueItemId: row.id, decisionKind: input.decisionKind },
      });
    }
    auditPrivilegedMutation({
      actorUserId: input.actorUserId,
      action: "realm.moderation.decided",
      targetKind: "realm-moderation-queue",
      targetId: row.id,
      decisionCode: (input.decision?.code as string | undefined) ?? "ALLOWED",
      reason: input.reason,
      correlationId: row.linkedCaseId ?? row.id,
      after: { state: row.state, decisionKind: input.decisionKind },
      metadata: { realmUnitId: input.realmUnitId },
    });
    return mapRealmQueueItemToDTO(row);
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
      const queue = await tx.realmModerationQueueItem.findUniqueOrThrow({
        where: { id: input.queueItemId },
      });
      let caseId = input.caseId ?? queue.linkedCaseId;
      if (!caseId) {
        const moderationCase = await tx.moderationCase.create({
          data: {
            state: "ESCALATED",
            severity: null,
            reporterUserId: queue.reporterUserId,
            subjectUserId: queue.subjectUserId,
            targetKind: queue.targetKind,
            targetId: queue.targetId,
            addressedUnitId: queue.addressedUnitId,
            realmUnitId: input.realmUnitId,
            sourceFeedbackId: queue.sourceFeedbackId,
            reason: input.reason,
            safeSummary: input.safeSummary ?? queue.safeSummary,
            metadata: { escalatedFromRealmQueueItemId: queue.id } as never,
          },
        });
        caseId = moderationCase.id;
        await this.createCaseEvent(tx, {
          caseId,
          actorUserId: input.actorUserId,
          eventType: "case.escalated_from_realm_queue",
          reason: input.reason,
          after: {
            realmUnitId: input.realmUnitId,
            queueItemId: queue.id,
          },
          reversible: false,
        });
      }
      const updated = await tx.realmModerationQueueItem.update({
        where: { id: input.queueItemId },
        data: {
          state: "ESCALATED",
          linkedCaseId: caseId,
          reason: input.reason,
          safeSummary: input.safeSummary ?? queue.safeSummary,
        },
      });
      await this.createRealmQueueEvent(tx, {
        queueItemId: input.queueItemId,
        realmUnitId: input.realmUnitId,
        actorUserId: input.actorUserId,
        decisionKind: "escalate",
        reason: input.reason,
        before: {
          state: queue.state,
          linkedCaseId: queue.linkedCaseId,
        },
        after: {
          state: updated.state,
          linkedCaseId: updated.linkedCaseId,
        },
      });
      return updated;
    });
    notifyModeration({
      kind: "moderation.escalation.updated",
      recipientUserId: row.reporterUserId,
      sourceUnitId: row.addressedUnitId ?? row.realmUnitId ?? row.targetId,
      actorUserId: input.actorUserId,
      extra: { queueItemId: row.id, linkedCaseId: row.linkedCaseId },
    });
    auditPrivilegedMutation({
      actorUserId: input.actorUserId,
      action: "realm.moderation.escalated",
      targetKind: "realm-moderation-queue",
      targetId: row.id,
      reason: input.reason,
      correlationId: row.linkedCaseId ?? row.id,
      after: { state: row.state, linkedCaseId: row.linkedCaseId },
      metadata: { realmUnitId: input.realmUnitId },
    });
    return mapRealmQueueItemToDTO(row);
  }

  async getGlobalContentState(moderatedUnitId: string) {
    const row = await prisma.contentModerationState.findUnique({
      where: { moderatedUnitId },
    });
    return row ? mapContentModerationStateToDTO(row) : null;
  }

  async listGlobalContentStates(moderatedUnitIds: string[]) {
    const ids = [...new Set(moderatedUnitIds)];
    if (ids.length === 0) return [];

    const rows = await prisma.contentModerationState.findMany({
      where: { moderatedUnitId: { in: ids } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapContentModerationStateToDTO);
  }

  async setGlobalContentState(input: ContentModerationStateInput) {
    const data = contentModerationData(input);
    const row = input.caseId
      ? await prisma.$transaction(async (tx) => {
          const before = await tx.contentModerationState.findUnique({
            where: { moderatedUnitId: input.moderatedUnitId },
          });
          const updated = await tx.contentModerationState.upsert({
            where: { moderatedUnitId: input.moderatedUnitId },
            create: {
              moderatedUnitId: input.moderatedUnitId,
              ...data,
            },
            update: data,
          });
          await this.createCaseEvent(tx, {
            caseId: input.caseId as string,
            actorUserId: input.decidedById ?? "",
            eventType: contentModerationEventType({ state: input.state }),
            reason: input.reason ?? null,
            before: before
              ? contentModerationEventSummary({
                  state: before.state,
                  reason: before.reason,
                  moderatedUnitId: input.moderatedUnitId,
                })
              : null,
            after: contentModerationEventSummary({
              state: updated.state,
              reason: updated.reason,
              moderatedUnitId: input.moderatedUnitId,
            }),
            reversible: input.state !== "visible",
          });
          return updated;
        })
      : await prisma.contentModerationState.upsert({
          where: { moderatedUnitId: input.moderatedUnitId },
          create: {
            moderatedUnitId: input.moderatedUnitId,
            ...data,
          },
          update: data,
        });
    await enqueueModeratedContentSearch(input.moderatedUnitId);
    auditPrivilegedMutation({
      actorUserId: input.decidedById ?? "",
      action: "content.moderation.state_changed",
      targetKind: "content",
      targetId: input.moderatedUnitId,
      reason: input.reason ?? "content moderation state changed",
      correlationId: input.caseId ?? input.moderatedUnitId,
      after: { state: row.state, caseId: row.caseId },
    });
    return mapContentModerationStateToDTO(row);
  }

  async hideGlobal(input: ModerationDecisionInput) {
    return this.setGlobalContentState({
      ...input,
      state: "hidden",
    });
  }

  async tombstoneGlobal(input: ModerationDecisionInput) {
    return this.setGlobalContentState({
      ...input,
      state: "tombstoned",
    });
  }

  async restoreGlobal(input: ModerationDecisionInput) {
    return this.setGlobalContentState({
      ...input,
      state: "visible",
    });
  }

  async listRealmContentOverlays(input: {
    realmUnitId: string;
    moderatedUnitIds: string[];
  }) {
    const moderatedUnitIds = [...new Set(input.moderatedUnitIds)];
    if (moderatedUnitIds.length === 0) return [];

    const rows = await prisma.realmContentModeration.findMany({
      where: {
        realmUnitId: input.realmUnitId,
        moderatedUnitId: { in: moderatedUnitIds },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapRealmContentModerationToDTO);
  }

  async setRealmContentOverlay(
    input: ContentModerationStateInput & { realmUnitId: string },
  ) {
    const data = contentModerationData(input);
    const row = input.caseId
      ? await prisma.$transaction(async (tx) => {
          const before = await tx.realmContentModeration.findUnique({
            where: {
              realmUnitId_moderatedUnitId: {
                realmUnitId: input.realmUnitId,
                moderatedUnitId: input.moderatedUnitId,
              },
            },
          });
          const updated = await tx.realmContentModeration.upsert({
            where: {
              realmUnitId_moderatedUnitId: {
                realmUnitId: input.realmUnitId,
                moderatedUnitId: input.moderatedUnitId,
              },
            },
            create: {
              realmUnitId: input.realmUnitId,
              moderatedUnitId: input.moderatedUnitId,
              ...data,
            },
            update: data,
          });
          await this.createCaseEvent(tx, {
            caseId: input.caseId as string,
            actorUserId: input.decidedById ?? "",
            eventType: contentModerationEventType({
              state: input.state,
              realmUnitId: input.realmUnitId,
            }),
            reason: input.reason ?? null,
            before: before
              ? contentModerationEventSummary({
                  state: before.state,
                  reason: before.reason,
                  moderatedUnitId: input.moderatedUnitId,
                  realmUnitId: input.realmUnitId,
                })
              : null,
            after: contentModerationEventSummary({
              state: updated.state,
              reason: updated.reason,
              moderatedUnitId: input.moderatedUnitId,
              realmUnitId: input.realmUnitId,
            }),
            reversible: input.state !== "visible",
          });
          return updated;
        })
      : await prisma.realmContentModeration.upsert({
          where: {
            realmUnitId_moderatedUnitId: {
              realmUnitId: input.realmUnitId,
              moderatedUnitId: input.moderatedUnitId,
            },
          },
          create: {
            realmUnitId: input.realmUnitId,
            moderatedUnitId: input.moderatedUnitId,
            ...data,
          },
          update: data,
        });
    auditPrivilegedMutation({
      actorUserId: input.decidedById ?? "",
      action: "realm.content.moderation.state_changed",
      targetKind: "realm-content",
      targetId: input.moderatedUnitId,
      reason: input.reason ?? "realm content moderation state changed",
      correlationId:
        input.caseId ?? `${input.realmUnitId}:${input.moderatedUnitId}`,
      after: { state: row.state, caseId: row.caseId },
      metadata: { realmUnitId: input.realmUnitId },
    });
    return mapRealmContentModerationToDTO(row);
  }

  async hideInRealm(input: ModerationDecisionInput & { realmUnitId: string }) {
    return this.setRealmContentOverlay({
      ...input,
      state: "hidden",
    });
  }

  async tombstoneInRealm(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.setRealmContentOverlay({
      ...input,
      state: "tombstoned",
    });
  }

  async restoreInRealm(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    return this.setRealmContentOverlay({
      ...input,
      state: "visible",
    });
  }

  async removeRootFromRealm(input: {
    realmUnitId: string;
    targetUnitId: string;
  }) {
    await prisma.unitRealm.delete({
      where: {
        realmUnitId_unitId: {
          realmUnitId: input.realmUnitId,
          unitId: input.targetUnitId,
        },
      },
    });
    await enqueueRealmMembershipSearch(input.targetUnitId);
    return { message: "Content removed from realm feed" };
  }

  async requestOwnerDelegation(
    input: ModerationDecisionInput & { realmUnitId: string },
  ) {
    const row = await prisma.realmModerationQueueItem.create({
      data: {
        realmUnitId: input.realmUnitId,
        state: "NEW",
        targetKind: "content-owner-delegation",
        targetId: input.moderatedUnitId,
        addressedUnitId: input.moderatedUnitId,
        assignedToUserId: input.decidedById,
        reason: input.reason,
        metadata: {
          ...(input.metadata ?? {}),
          ownerDelegation: true,
        } as never,
      },
    });
    return mapRealmQueueItemToDTO(row);
  }
}

export const governanceModerationService = new GovernanceModerationService();

import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { Prisma, prisma } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "../utils/errors";
import {
  mapContentModerationStateToDTO,
  mapModerationCaseEventToDTO,
  mapModerationCaseToDTO,
  mapRealmContentModerationToDTO,
  mapRealmQueueItemToDTO,
} from "./governance.mapper";
import type { GovernanceListOptions } from "./types";

type ContentModerationStateInput = {
  targetUnitId: string;
  state: "visible" | "hidden" | "tombstoned" | "locked" | "archived";
  decidedById?: string | null;
  caseId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

type ModerationDecisionInput = {
  targetUnitId: string;
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

function enqueueModeratedContentSearch(targetUnitId: string) {
  return Promise.all([
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentSync,
        { unitId: targetUnitId },
        { type: "server", service: "governance" },
      ),
    ),
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postSync,
        { postId: targetUnitId },
        { type: "server", service: "governance" },
      ),
    ),
  ]);
}

function enqueueRealmMembershipSearch(targetUnitId: string) {
  return Promise.all([
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentPatchRealmIds,
        { unitId: targetUnitId },
        { type: "server", service: "governance" },
      ),
    ),
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postSync,
        { postId: targetUnitId },
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
          targetUnitId: feedback.unitId ?? null,
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
          targetUnitId: feedback.unitId,
        },
      });
      return created;
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

  async getGlobalContentState(targetUnitId: string) {
    const row = await prisma.contentModerationState.findUnique({
      where: { targetUnitId },
    });
    return row ? mapContentModerationStateToDTO(row) : null;
  }

  async listGlobalContentStates(targetUnitIds: string[]) {
    const ids = [...new Set(targetUnitIds)];
    if (ids.length === 0) return [];

    const rows = await prisma.contentModerationState.findMany({
      where: { targetUnitId: { in: ids } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapContentModerationStateToDTO);
  }

  async setGlobalContentState(input: ContentModerationStateInput) {
    const data = contentModerationData(input);
    const row = await prisma.contentModerationState.upsert({
      where: { targetUnitId: input.targetUnitId },
      create: {
        targetUnitId: input.targetUnitId,
        ...data,
      },
      update: data,
    });
    await enqueueModeratedContentSearch(input.targetUnitId);
    return mapContentModerationStateToDTO(row);
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
    targetUnitIds: string[];
  }) {
    const targetUnitIds = [...new Set(input.targetUnitIds)];
    if (targetUnitIds.length === 0) return [];

    const rows = await prisma.realmContentModeration.findMany({
      where: {
        realmUnitId: input.realmUnitId,
        targetUnitId: { in: targetUnitIds },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapRealmContentModerationToDTO);
  }

  async setRealmContentOverlay(
    input: ContentModerationStateInput & { realmUnitId: string },
  ) {
    const data = contentModerationData(input);
    const row = await prisma.realmContentModeration.upsert({
      where: {
        realmUnitId_targetUnitId: {
          realmUnitId: input.realmUnitId,
          targetUnitId: input.targetUnitId,
        },
      },
      create: {
        realmUnitId: input.realmUnitId,
        targetUnitId: input.targetUnitId,
        ...data,
      },
      update: data,
    });
    return mapRealmContentModerationToDTO(row);
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
    const post = await prisma.post.findUnique({
      where: { unitId: input.targetUnitId },
      select: { parentPostUnitId: true },
    });
    if (post?.parentPostUnitId) {
      throw new AppError(
        400,
        "Realm feed removal only applies to thread roots",
      );
    }

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
        targetId: input.targetUnitId,
        targetUnitId: input.targetUnitId,
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

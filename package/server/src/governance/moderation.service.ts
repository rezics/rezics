import { prisma } from "#/prisma/client";
import { AppError } from "../utils/errors";
import {
  mapContentModerationStateToDTO,
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

function toPrismaState(input: ContentModerationStateInput["state"]) {
  return input.toUpperCase() as Uppercase<ContentModerationStateInput["state"]>;
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

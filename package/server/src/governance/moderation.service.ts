import { prisma } from "#/prisma/client";
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
}

export const governanceModerationService = new GovernanceModerationService();

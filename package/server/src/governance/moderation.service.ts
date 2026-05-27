import { prisma } from "#/prisma/client";
import {
  mapModerationCaseToDTO,
  mapRealmQueueItemToDTO,
} from "./governance.mapper";
import type { GovernanceListOptions } from "./types";

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
}

export const governanceModerationService = new GovernanceModerationService();

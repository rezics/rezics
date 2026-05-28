import type {
  GameLibraryContentDTO,
  MediaLibraryContentDTO,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import {
  mapGameLibraryContentToDTO,
  mapMediaLibraryContentToDTO,
} from "./mapper";
import { gameLibraryInclude, mediaLibraryInclude } from "./types";

export interface GameMetadataRelationInput {
  platformEntityIds?: readonly string[];
  ageRatingTagUnitIds?: readonly string[];
}

export class GameMediaLibraryService {
  async getGame(unitId: string): Promise<GameLibraryContentDTO | null> {
    const row = await prisma.game.findUnique({
      where: { unitId },
      include: gameLibraryInclude,
    });
    return row ? mapGameLibraryContentToDTO(row) : null;
  }

  async getMedia(unitId: string): Promise<MediaLibraryContentDTO | null> {
    const row = await prisma.media.findUnique({
      where: { unitId },
      include: mediaLibraryInclude,
    });
    return row ? mapMediaLibraryContentToDTO(row) : null;
  }

  async appendGameMetadataRelations(
    gameUnitId: string,
    input: GameMetadataRelationInput,
  ): Promise<void> {
    if (input.platformEntityIds?.length) {
      const platforms = await prisma.entity.findMany({
        where: {
          unitId: { in: [...input.platformEntityIds] },
          kind: "game_platform",
          eligibleSubjectRoles: { has: "available_on" },
        },
        select: { unitId: true },
      });
      const found = new Set(platforms.map((platform) => platform.unitId));
      const missing = input.platformEntityIds.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new Error(
          `Invalid game platform Entity id(s): ${missing.join(", ")}`,
        );
      }

      await prisma.subjectAttribution.createMany({
        data: input.platformEntityIds.map((entityId, sortOrder) => ({
          unitId: gameUnitId,
          entityId,
          role: "available_on",
          sortOrder,
        })),
        skipDuplicates: true,
      });
    }

    if (input.ageRatingTagUnitIds?.length) {
      await prisma.unitTag.createMany({
        data: input.ageRatingTagUnitIds.map((tagUnitId) => ({
          unitId: gameUnitId,
          tagUnitId,
          score: 0,
          voteCount: 0,
          pinned: true,
        })),
        skipDuplicates: true,
      });
    }
  }
}

export const gameMediaLibraryService = new GameMediaLibraryService();

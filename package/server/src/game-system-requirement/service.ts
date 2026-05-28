import type {
  CreateGameSystemRequirementInput,
  GameSystemRequirementListFilters,
  UpdateGameSystemRequirementInput,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { AppError } from "@/utils/errors";
import { gameSystemRequirementSelect } from "./types";

async function assertGameExists(gameUnitId: string) {
  await prisma.game.findUniqueOrThrow({
    where: { unitId: gameUnitId },
    select: { unitId: true },
  });
}

async function assertPlatformEntity(
  platformEntityId: string | null | undefined,
) {
  if (!platformEntityId) {
    return;
  }

  const platform = await prisma.entity.findUniqueOrThrow({
    where: { unitId: platformEntityId },
    select: { kind: true, eligibleSubjectRoles: true },
  });
  if (
    platform.kind !== "game_platform" ||
    !platform.eligibleSubjectRoles.includes("available_on")
  ) {
    throw new AppError(400, "Platform must be a game_platform Entity", {
      code: "game_requirement_platform_invalid",
      details: { platformEntityId },
    });
  }
}

async function assertSourceRef(
  gameUnitId: string,
  sourceRefId: string | null | undefined,
) {
  if (!sourceRefId) {
    return;
  }

  const sourceRef = await prisma.unitExternalRef.findUniqueOrThrow({
    where: { id: sourceRefId },
    select: { id: true, unitId: true },
  });
  if (sourceRef.unitId !== gameUnitId) {
    throw new AppError(
      400,
      "Game system requirement sourceRefId must reference the same game Unit",
      {
        code: "game_requirement_source_ref_unit_mismatch",
        details: { gameUnitId, sourceRefId, sourceRefUnitId: sourceRef.unitId },
      },
    );
  }
}

export class GameSystemRequirementService {
  async list(filters: GameSystemRequirementListFilters = {}) {
    return prisma.gameSystemRequirement.findMany({
      where: {
        ...(filters.gameUnitId ? { gameUnitId: filters.gameUnitId } : {}),
        ...(filters.platformEntityId !== undefined
          ? { platformEntityId: filters.platformEntityId }
          : {}),
        ...(filters.tier ? { tier: filters.tier } : {}),
        ...(filters.language ? { language: filters.language } : {}),
        ...(filters.sourceRefId ? { sourceRefId: filters.sourceRefId } : {}),
      },
      select: gameSystemRequirementSelect,
      orderBy: [
        { platformEntityId: "asc" },
        { tier: "asc" },
        { language: "asc" },
        { createdAt: "asc" },
      ],
    });
  }

  async getById(id: string) {
    return prisma.gameSystemRequirement.findUnique({
      where: { id },
      select: gameSystemRequirementSelect,
    });
  }

  async create(input: CreateGameSystemRequirementInput) {
    await assertGameExists(input.gameUnitId);
    await assertPlatformEntity(input.platformEntityId);
    await assertSourceRef(input.gameUnitId, input.sourceRefId);

    return prisma.gameSystemRequirement.create({
      data: {
        gameUnitId: input.gameUnitId,
        platformEntityId: input.platformEntityId ?? null,
        tier: input.tier,
        language: input.language ?? null,
        sourceRefId: input.sourceRefId ?? null,
        hardware: input.hardware as any,
        rawText: input.rawText ?? null,
      },
      select: gameSystemRequirementSelect,
    });
  }

  async update(id: string, input: UpdateGameSystemRequirementInput) {
    if (input.platformEntityId !== undefined) {
      await assertPlatformEntity(input.platformEntityId);
    }
    if (input.sourceRefId !== undefined) {
      const current = await prisma.gameSystemRequirement.findUniqueOrThrow({
        where: { id },
        select: { gameUnitId: true },
      });
      await assertSourceRef(current.gameUnitId, input.sourceRefId);
    }

    return prisma.gameSystemRequirement.update({
      where: { id },
      data: {
        platformEntityId: input.platformEntityId,
        tier: input.tier,
        language: input.language,
        sourceRefId: input.sourceRefId,
        hardware: input.hardware as any,
        rawText: input.rawText,
      },
      select: gameSystemRequirementSelect,
    });
  }

  async delete(id: string) {
    await prisma.gameSystemRequirement.delete({ where: { id } });
  }
}

export const gameSystemRequirementService = new GameSystemRequirementService();

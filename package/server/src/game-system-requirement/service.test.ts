import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";
import { mapGameSystemRequirementToDTO } from "./mapper";

installPrismaClientMock();

const now = new Date("2026-05-28T00:00:00.000Z");

function requirementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    gameUnitId: "game-1",
    platformEntityId: "platform-windows",
    tier: "minimum",
    language: "en",
    sourceRefId: "source-ref-1",
    hardware: { memory: "8 GB" },
    rawText: "Requires a 64-bit processor and operating system.",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function freshMocks() {
  const row = requirementRow();
  Object.assign(prismaMock, {
    game: {
      findUniqueOrThrow: mock(async () => ({ unitId: "game-1" })),
    },
    entity: {
      findUniqueOrThrow: mock(async () => ({
        kind: "game_platform",
        eligibleSubjectRoles: ["available_on"],
      })),
    },
    unitExternalRef: {
      findUniqueOrThrow: mock(async () => ({
        id: "source-ref-1",
        unitId: "game-1",
      })),
    },
    gameSystemRequirement: {
      findMany: mock(async () => [row]),
      findUnique: mock(async () => row),
      create: mock(async ({ data }: any) => ({ ...row, ...data })),
      update: mock(async ({ data }: any) => ({ ...row, ...data })),
      delete: mock(async () => row),
    },
  });
  return row;
}

describe("GameSystemRequirementService", () => {
  test("lists requirements with contract filters", async () => {
    freshMocks();
    const { gameSystemRequirementService } = await import("./service");

    const rows = await gameSystemRequirementService.list({
      gameUnitId: "game-1",
      platformEntityId: "platform-windows",
      tier: "minimum",
      language: "en",
      sourceRefId: "source-ref-1",
    });

    expect(rows).toHaveLength(1);
    expect(prismaMock.gameSystemRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          gameUnitId: "game-1",
          platformEntityId: "platform-windows",
          tier: "minimum",
          language: "en",
          sourceRefId: "source-ref-1",
        },
      }),
    );
  });

  test("creates a requirement only for valid game, platform, and source refs", async () => {
    freshMocks();
    const { gameSystemRequirementService } = await import("./service");

    await gameSystemRequirementService.create({
      gameUnitId: "game-1",
      platformEntityId: "platform-windows",
      tier: "recommended",
      language: "en",
      sourceRefId: "source-ref-1",
      hardware: { memory: "16 GB" },
      rawText: "Recommended specs",
    });

    expect(prismaMock.game.findUniqueOrThrow).toHaveBeenCalled();
    expect(prismaMock.entity.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: "platform-windows" },
      }),
    );
    expect(prismaMock.unitExternalRef.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "source-ref-1" },
        select: { id: true, unitId: true },
      }),
    );
    expect(prismaMock.gameSystemRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gameUnitId: "game-1",
          platformEntityId: "platform-windows",
          tier: "recommended",
          sourceRefId: "source-ref-1",
          hardware: { memory: "16 GB" },
        }),
      }),
    );
  });

  test("rejects non-platform entities", async () => {
    freshMocks();
    prismaMock.entity.findUniqueOrThrow = mock(async () => ({
      kind: "organization",
      eligibleSubjectRoles: [],
    }));
    const { gameSystemRequirementService } = await import("./service");

    await expect(
      gameSystemRequirementService.create({
        gameUnitId: "game-1",
        platformEntityId: "entity-1",
        tier: "minimum",
        hardware: {},
      }),
    ).rejects.toThrow(/game_platform/);
  });

  test("rejects requirement source refs for another unit", async () => {
    freshMocks();
    prismaMock.unitExternalRef.findUniqueOrThrow = mock(async () => ({
      id: "source-ref-1",
      unitId: "other-game",
    }));
    const { gameSystemRequirementService } = await import("./service");

    await expect(
      gameSystemRequirementService.create({
        gameUnitId: "game-1",
        platformEntityId: "platform-windows",
        tier: "minimum",
        sourceRefId: "source-ref-1",
        hardware: {},
      }),
    ).rejects.toThrow(/same game Unit/);
  });

  test("maps storage rows to contract DTOs", () => {
    const dto = mapGameSystemRequirementToDTO(requirementRow() as any);

    expect(dto).toEqual({
      id: "req-1",
      gameUnitId: "game-1",
      platformEntityId: "platform-windows",
      tier: "minimum",
      language: "en",
      sourceRefId: "source-ref-1",
      hardware: { memory: "8 GB" },
      rawText: "Requires a 64-bit processor and operating system.",
      createdAt: now,
      updatedAt: now,
    });
  });
});

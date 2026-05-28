import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

function freshMocks() {
  Object.assign(prismaMock, {
    entity: {
      findMany: mock(async () => [
        { unitId: "platform-windows" },
        { unitId: "platform-steam" },
      ]),
    },
    subjectAttribution: {
      createMany: mock(async ({ data }: any) => ({ count: data.length })),
    },
    unitTag: {
      createMany: mock(async ({ data }: any) => ({ count: data.length })),
    },
    game: {
      findUnique: mock(async () => null),
    },
    media: {
      findUnique: mock(async () => null),
    },
  });
}

describe("GameMediaLibraryService", () => {
  test("writes GAME platform Entities and rating tags through canonical relations", async () => {
    freshMocks();
    const { gameMediaLibraryService } = await import("./service");

    await gameMediaLibraryService.appendGameMetadataRelations("game-1", {
      platformEntityIds: ["platform-windows", "platform-steam"],
      ageRatingTagUnitIds: ["tag-esrb-teen"],
    });

    expect(prismaMock.entity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unitId: { in: ["platform-windows", "platform-steam"] },
          kind: "game_platform",
          eligibleSubjectRoles: { has: "available_on" },
        }),
      }),
    );
    expect(prismaMock.subjectAttribution.createMany).toHaveBeenCalledWith({
      data: [
        {
          unitId: "game-1",
          entityId: "platform-windows",
          role: "available_on",
          sortOrder: 0,
        },
        {
          unitId: "game-1",
          entityId: "platform-steam",
          role: "available_on",
          sortOrder: 1,
        },
      ],
      skipDuplicates: true,
    });
    expect(prismaMock.unitTag.createMany).toHaveBeenCalledWith({
      data: [
        {
          unitId: "game-1",
          tagUnitId: "tag-esrb-teen",
          score: 0,
          voteCount: 0,
          pinned: true,
        },
      ],
      skipDuplicates: true,
    });
  });

  test("rejects unknown platform Entity ids before writing relations", async () => {
    freshMocks();
    prismaMock.entity.findMany = mock(async () => [
      { unitId: "platform-windows" },
    ]);
    const { gameMediaLibraryService } = await import("./service");

    await expect(
      gameMediaLibraryService.appendGameMetadataRelations("game-1", {
        platformEntityIds: ["platform-windows", "platform-missing"],
      }),
    ).rejects.toThrow(/platform-missing/);
    expect(prismaMock.subjectAttribution.createMany).not.toHaveBeenCalled();
  });
});

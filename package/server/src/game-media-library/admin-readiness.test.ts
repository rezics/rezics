import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

function freshMocks() {
  Object.assign(prismaMock, {
    entity: {
      findMany: mock(async () => [
        {
          unitId: "platform-windows",
          unit: {
            slug: "windows",
            translations: [{ language: "en", title: "Windows" }],
          },
        },
        {
          unitId: "platform-steam",
          unit: {
            slug: "steam",
            translations: [{ language: "en", title: "Steam" }],
          },
        },
      ]),
    },
    unit: {
      findMany: mock(async () => [
        {
          id: "tag-esrb-teen",
          slug: "esrb-teen",
          translations: [{ language: "en", title: "ESRB Teen" }],
        },
      ]),
    },
    gameSystemRequirement: {
      findMany: mock(async () => []),
    },
  });
}

describe("GameMediaAdminReadinessService", () => {
  test("lists admin platform and rating taxonomy surfaces", async () => {
    freshMocks();
    const { gameMediaAdminReadinessService } = await import(
      "./admin-readiness"
    );

    await expect(
      gameMediaAdminReadinessService.listPlatformEntities(),
    ).resolves.toEqual([
      {
        entityUnitId: "platform-windows",
        slug: "windows",
        label: "Windows",
        translations: [{ language: "en", title: "Windows" }],
      },
      {
        entityUnitId: "platform-steam",
        slug: "steam",
        label: "Steam",
        translations: [{ language: "en", title: "Steam" }],
      },
    ]);

    const ratingTags = await gameMediaAdminReadinessService.listRatingTags();
    expect(ratingTags.find((tag) => tag.slug === "esrb-teen")).toEqual({
      slug: "esrb-teen",
      tagUnitId: "tag-esrb-teen",
      label: "ESRB Teen",
      translations: [{ language: "en", title: "ESRB Teen" }],
    });
    expect(ratingTags.find((tag) => tag.slug === "pegi-18")).toMatchObject({
      slug: "pegi-18",
      tagUnitId: null,
    });
  });

  test("reports missing taxonomy", async () => {
    freshMocks();
    const { gameMediaAdminReadinessService } = await import(
      "./admin-readiness"
    );

    const diagnostics = await gameMediaAdminReadinessService.diagnostics();

    expect(diagnostics.missingPlatformSlugs).toContain("macos");
    expect(diagnostics.missingRatingTagSlugs).toContain("pegi-18");
  });

  test("delegates requirement rows to the requirement service filters", async () => {
    freshMocks();
    const { gameMediaAdminReadinessService } = await import(
      "./admin-readiness"
    );

    await gameMediaAdminReadinessService.listSystemRequirements({
      gameUnitId: "game-1",
    });

    expect(prismaMock.gameSystemRequirement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gameUnitId: "game-1" }),
      }),
    );
  });
});

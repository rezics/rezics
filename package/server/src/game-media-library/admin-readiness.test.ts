import { describe, expect, mock, test } from "bun:test";
import type { GameMediaAdminReadinessRepository } from "./admin-readiness";

const listSystemRequirements = mock(async (_filters: unknown) => []);

mock.module("../game-system-requirement/service", () => ({
  gameSystemRequirementService: {
    list: listSystemRequirements,
  },
}));

const repository = {
  listPlatformEntities: mock(async () => [
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
  ]),
  listRatingTags: mock(async () => [
    {
      id: "tag-esrb-teen",
      slug: "esrb-teen",
      translations: [{ language: "en", title: "ESRB Teen" }],
    },
  ]),
} satisfies GameMediaAdminReadinessRepository;

async function readinessService() {
  const { gameMediaAdminReadinessService } = await import("./admin-readiness");
  gameMediaAdminReadinessService.repository = repository;
  return gameMediaAdminReadinessService;
}

describe("GameMediaAdminReadinessService", () => {
  test("lists admin platform and rating taxonomy surfaces", async () => {
    const gameMediaAdminReadinessService = await readinessService();

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
    const gameMediaAdminReadinessService = await readinessService();

    const diagnostics = await gameMediaAdminReadinessService.diagnostics();

    expect(diagnostics.missingPlatformSlugs).toContain("macos");
    expect(diagnostics.missingRatingTagSlugs).toContain("pegi-18");
  });

  test("delegates requirement rows to the requirement service filters", async () => {
    listSystemRequirements.mockClear();
    const gameMediaAdminReadinessService = await readinessService();

    await gameMediaAdminReadinessService.listSystemRequirements({
      gameUnitId: "game-1",
    });

    expect(listSystemRequirements).toHaveBeenCalledWith({
      gameUnitId: "game-1",
    });
  });
});

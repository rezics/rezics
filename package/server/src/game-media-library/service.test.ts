import { describe, expect, mock, test } from "bun:test";
import type {
  GameMediaLibraryRepository,
  GameMediaLibraryService,
} from "./service";

function createRepository(
  overrides: Partial<GameMediaLibraryRepository> = {},
): GameMediaLibraryRepository {
  return {
    getGame: mock(async () => null),
    getMedia: mock(async () => null),
    listValidGamePlatformIds: mock(async () => [
      "platform-windows",
      "platform-steam",
    ]),
    appendAvailableOnRelations: mock(async () => {}),
    appendAgeRatingTags: mock(async () => {}),
    ...overrides,
  };
}

async function createService(
  repository: GameMediaLibraryRepository,
): Promise<GameMediaLibraryService> {
  const { GameMediaLibraryService } = await import("./service");
  return new GameMediaLibraryService(repository);
}

describe("GameMediaLibraryService", () => {
  test("writes GAME platform Entities and rating tags through canonical relations", async () => {
    const appendAvailableOnRelations = mock(async () => {});
    const appendAgeRatingTags = mock(async () => {});
    const repository = createRepository({
      appendAvailableOnRelations,
      appendAgeRatingTags,
    });

    await (await createService(repository)).appendGameMetadataRelations(
      "game-1",
      {
        platformEntityIds: ["platform-windows", "platform-steam"],
        ageRatingTagUnitIds: ["tag-esrb-teen"],
      },
    );

    expect(repository.listValidGamePlatformIds).toHaveBeenCalledWith([
      "platform-windows",
      "platform-steam",
    ]);
    expect(appendAvailableOnRelations).toHaveBeenCalledWith("game-1", [
      "platform-windows",
      "platform-steam",
    ]);
    expect(appendAgeRatingTags).toHaveBeenCalledWith("game-1", [
      "tag-esrb-teen",
    ]);
  });

  test("rejects unknown platform Entity ids before writing relations", async () => {
    const appendAvailableOnRelations = mock(async () => {});
    const repository = createRepository({
      listValidGamePlatformIds: mock(async () => ["platform-windows"]),
      appendAvailableOnRelations,
    });

    await expect(
      (await createService(repository)).appendGameMetadataRelations("game-1", {
        platformEntityIds: ["platform-windows", "platform-missing"],
      }),
    ).rejects.toThrow(/platform-missing/);
    expect(appendAvailableOnRelations).not.toHaveBeenCalled();
  });
});

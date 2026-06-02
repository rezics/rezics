import { describe, expect, test } from "bun:test";
import {
  mapGameLibraryContentToDTO,
  mapMediaLibraryContentToDTO,
} from "./mapper";

const now = new Date("2026-05-28T00:00:00.000Z");

function unitBase(overrides: Record<string, unknown> = {}) {
  return {
    translations: [],
    unitTags: [
      {
        tagUnitId: "tag-esrb-teen",
        tag: { id: "tag-esrb-teen", slug: "esrb-teen" },
      },
      { tagUnitId: "tag-genre", tag: { id: "tag-genre", slug: "rpg" } },
    ],
    ...overrides,
  };
}

describe("GAME/MEDIA library mappers", () => {
  test("maps GAME platform Entities, rating tags, and requirements", () => {
    const dto = mapGameLibraryContentToDTO({
      unitId: "game-1",
      unit: unitBase({
        subjectAttributions: [
          { entityId: "platform-windows" },
          { entityId: "platform-steam" },
        ],
        ownedContentStructure: {
          ownerUnitId: "game-1",
          createdAt: now,
          updatedAt: now,
          contentNodes: [
            {
              id: "node-dlc",
              ownerUnitId: "game-1",
              parentId: null,
              position: "a0",
              contentUnitId: "dlc-1",
              title: "Expansion",
              noContent: false,
              rating: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      }),
      systemRequirements: [
        {
          platformEntityId: "platform-windows",
          tier: "minimum",
          language: "en",
          hardware: { memory: "8 GB" },
        },
      ],
    } as any);

    expect(dto.game.platformEntityIds).toEqual([
      "platform-windows",
      "platform-steam",
    ]);
    expect(dto.game.ageRatingTagUnitIds).toEqual(["tag-esrb-teen"]);
    expect(dto.contentStructure?.nodes[0]?.contentUnitId).toBe("dlc-1");
    expect(dto.game.systemRequirementSummaries).toEqual([
      {
        platformEntityId: "platform-windows",
        tier: "minimum",
        language: "en",
        hardware: { memory: "8 GB" },
      },
    ]);
  });

  test("maps MEDIA rating tags and content-structure availability", () => {
    const dto = mapMediaLibraryContentToDTO({
      unitId: "media-1",
      runtimeMinutes: 24,
      kindKey: "episode",
      unit: unitBase({
        ownedContentStructure: {
          ownerUnitId: "media-1",
          createdAt: now,
          updatedAt: now,
          contentNodes: [
            {
              id: "node-1",
              ownerUnitId: "media-1",
              parentId: null,
              position: "a0",
              contentUnitId: "episode-1",
              title: "Episode 1",
              noContent: false,
              rating: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      }),
    } as any);

    expect(dto.media.ageRatingTagUnitIds).toEqual(["tag-esrb-teen"]);
    expect(dto.media.contentStructureAvailable).toBe(true);
    expect(dto.contentStructure?.nodes[0]?.contentUnitId).toBe("episode-1");
  });
});

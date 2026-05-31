import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createGameSystemRequirementSchema,
  gameLibraryContentDTOSchema,
  gameSystemRequirementDTOSchema,
  gameSystemRequirementHardwareSchema,
  gameSystemRequirementListFiltersSchema,
  mediaLibraryContentDTOSchema,
  ratingTagSlugSchema,
} from "./game-media";
import {
  ContentSearchDocumentSchema,
  ContentSearchOptionsSchema,
} from "../meili";
import { SearchQuerySchema } from "../search/search";

const baseSearchDocument = {
  id: "game-release-1",
  type: "GAME",
  titles: ["Game"],
  subtitles: [],
  contentText: null,
  descriptionText: null,
  summaries: [],
  descriptions: [],
  creditNames: [],
  subjectNames: [],
  subjectEntityIds: [],
  subjectKinds: [],
  subjectRoles: [],
  tagLabels: [],
  aliasValues: [],
  tagIds: [],
  tagScores: {},
  catalogEntryKind: "MAIN",
  targetUnitId: null,
  seriesUnitIds: [],
  seriesKindKeys: [],
  seriesTitles: [],
  realmIds: [],
  translationGroupId: null,
  realmTagKeys: [],
  languages: ["en"],
  rating: "GENERAL",
  aiDisclosureMode: "UNKNOWN",
  visibility: "PUBLIC",
  isLicensed: false,
  postKind: null,
  textLength: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
  publishedAt: null,
  hotScore: 0,
  topScore: 0,
  trendingScore: 0,
  qualityScore: 0,
  rankUpdatedAt: null,
  defaultLanguage: "en",
  coverUrl: null,
  userId: null,
};

describe("GAME/MEDIA contract schemas", () => {
  test("validates rating tag slugs", () => {
    expect(Value.Check(ratingTagSlugSchema, "esrb-teen")).toBe(true);
    expect(Value.Check(ratingTagSlugSchema, "age-rating-teen")).toBe(false);
  });

  test("validates system requirement DTO and write shapes", () => {
    const hardware = {
      cpuSlugs: ["cpu:intel-core-i5-8400"],
      gpuSlugs: ["gpu:nvidia-gtx-1060-6gb"],
      memory: "8 GB",
      vram: "6 GB",
      storage: "70 GB",
      os: "Windows 10",
      graphicsApiSlugs: ["graphics-api:directx-12"],
    };

    expect(Value.Check(gameSystemRequirementHardwareSchema, hardware)).toBe(
      true,
    );
    expect(
      Value.Check(gameSystemRequirementHardwareSchema, {
        ...hardware,
        unknown: "not allowed",
      }),
    ).toBe(false);
    expect(
      Value.Check(gameSystemRequirementDTOSchema, {
        id: "req-1",
        gameUnitId: "game-1",
        platformEntityId: "platform-windows",
        tier: "minimum",
        language: "en",
        sourceRefId: "source-ref-1",
        hardware,
        rawText: "Requires a 64-bit processor and operating system.",
      }),
    ).toBe(true);
    expect(
      Value.Check(createGameSystemRequirementSchema, {
        gameUnitId: "game-1",
        tier: "recommended",
        hardware,
      }),
    ).toBe(true);
    expect(
      Value.Check(gameSystemRequirementListFiltersSchema, {
        gameUnitId: "game-1",
        platformEntityId: "platform-windows",
        tier: "minimum",
      }),
    ).toBe(true);
  });

  test("validates GAME/MEDIA library content metadata", () => {
    expect(
      Value.Check(gameLibraryContentDTOSchema, {
        unitId: "game-1",
        workUnitId: "work-1",
        metadata: { uswn: "work-1" },
        contentStructure: {
          ownerUnitId: "game-1",
          nodes: [{ title: "Expansion", contentUnitId: "dlc-1" }],
          createdAt: "2026-05-28T00:00:00.000Z",
          updatedAt: "2026-05-28T00:00:00.000Z",
        },
        game: {
          platformEntityIds: ["platform-steam"],
          ageRatingTagUnitIds: ["tag-esrb-teen"],
          systemRequirementSummaries: [
            {
              platformEntityId: "platform-windows",
              tier: "minimum",
              language: "en",
              hardware: { memory: "8 GB" },
            },
          ],
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(mediaLibraryContentDTOSchema, {
        unitId: "media-1",
        media: {
          ageRatingTagUnitIds: ["tag-tv-14"],
          contentStructureAvailable: true,
          runtimeMinutes: 24,
          kindKey: "episode",
        },
      }),
    ).toBe(true);
  });

  test("validates GAME/MEDIA search fields", () => {
    expect(
      Value.Check(SearchQuerySchema, {
        keyword: "game",
        platformEntityIds: ["platform-steam"],
        ageRatingTagUnitIds: ["tag-esrb-teen"],
      }),
    ).toBe(true);
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        platformEntityIds: ["platform-steam"],
        tagIds: ["tag-esrb-teen"],
      }),
    ).toBe(true);
    expect(
      Value.Check(ContentSearchDocumentSchema, {
        ...baseSearchDocument,
        platformEntityIds: ["platform-steam"],
        ratingTagUnitIds: ["tag-esrb-teen"],
        gameSystemRequirementSummaries: [
          {
            platformEntityId: "platform-windows",
            tier: "minimum",
            hardware: { storage: "70 GB" },
          },
        ],
      }),
    ).toBe(true);
  });
});

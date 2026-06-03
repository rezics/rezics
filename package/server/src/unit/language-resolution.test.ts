import { beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

mock.module("@/content-translation/mapper", () => ({
  mapContentTranslationToDTO: (row: any) => row,
}));
mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user,
  publicUserSelect: {},
}));
mock.module("./publication-policy", () => ({
  resolveStoredLicenseSlug: (value: unknown) => value,
}));

function resetMocks() {
  Object.assign(prismaMock, {
    unit: {
      findUniqueOrThrow: mock(async () => ({
        id: "post-1",
        supportLanguages: [
          { unitId: "post-1", language: "ja", isPrimary: true, sortOrder: 0 },
          { unitId: "post-1", language: "en", isPrimary: false, sortOrder: 1 },
        ],
        translations: [
          {
            unitId: "post-1",
            language: "en",
            title: "English title",
            description: markdownContentDoc("English description"),
            extra: null,
            sourceUnitId: null,
            createdAt: new Date("2026-06-03T00:00:00.000Z"),
            updatedAt: new Date("2026-06-03T00:00:00.000Z"),
          },
        ],
        contentTranslations: [
          {
            unitId: "post-1",
            language: "en",
            content: markdownContentDoc("English body"),
            status: "PUBLISHED",
            sourceUnitId: null,
            authorUserId: "user-1",
            provenance: null,
            createdAt: new Date("2026-06-03T00:00:00.000Z"),
            updatedAt: new Date("2026-06-03T00:00:00.000Z"),
          },
        ],
      })),
    },
  });
}

describe("UnitLanguageService.content", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("resolves supported but missing language rows to null fields", async () => {
    const { UnitLanguageService } = await import("./language-resolution");
    const service = new UnitLanguageService();

    const dto = await service.content("post-1", { languages: "ja,en" });

    expect(dto.resolvedLanguage).toBe("ja");
    expect(dto.unitTranslation).toBeNull();
    expect(dto.contentTranslation).toBeNull();
    expect(dto.title).toBeNull();
    expect(dto.description).toBeNull();
    expect(dto.content).toBeNull();
    expect(dto.supportLanguages.map((item) => item.language)).toEqual([
      "ja",
      "en",
    ]);
  });
});

describe("read language visibility helpers", () => {
  test("normalizes request, user, and app candidates without adding fallback", async () => {
    const { resolveEffectiveReadLanguageCandidates } = await import(
      "./language-resolution"
    );

    expect(
      resolveEffectiveReadLanguageCandidates({
        languages: "ja, en",
        actorSettings: { preferredLanguages: ["zh-Hant", "en"] },
        appLocale: "ko",
      }),
    ).toEqual(["ja", "en", "zh-hant", "ko"]);
    expect(resolveEffectiveReadLanguageCandidates({})).toEqual([]);
  });

  test("preferred visibility uses support languages plus language-neutral units", async () => {
    const { preferredLanguageVisibilityWhere } = await import(
      "./language-resolution"
    );

    expect(
      preferredLanguageVisibilityWhere({
        languageMode: "preferred",
        languages: ["ja", "en"],
      }),
    ).toEqual({
      OR: [
        { isLanguageNeutral: true },
        {
          supportLanguages: {
            some: { language: { in: ["ja", "en"] } },
          },
        },
      ],
    });
  });

  test("empty preferred candidate lists do not filter", async () => {
    const { preferredLanguageVisibilityWhere } = await import(
      "./language-resolution"
    );

    expect(
      preferredLanguageVisibilityWhere({
        languageMode: "preferred",
        languages: [],
      }),
    ).toBeUndefined();
    expect(
      preferredLanguageVisibilityWhere({
        languageMode: "all",
        languages: ["ja"],
      }),
    ).toBeUndefined();
  });
});

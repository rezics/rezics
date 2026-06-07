import { beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import type {
  UnitLanguageRepository,
  UnitLanguageService,
} from "./language-resolution";

const unitsMissingSupportLanguageRows = mock(async (_limit: number) => [
  {
    unitId: "post-1",
    language: "ja",
    source: "unit_translation" as const,
  },
  {
    unitId: "post-1",
    language: "ja",
    source: "content_translation" as const,
  },
]);

mock.module("../content-translation/mapper", () => ({
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
  unitsMissingSupportLanguageRows.mockClear();
}

function createRepository(): UnitLanguageRepository {
  return {
    unitsMissingSupportLanguageRows,
    getAvailabilityUnit: mock(async () => ({
      id: "post-1",
      supportLanguages: [
        { unitId: "post-1", language: "ja", isPrimary: true, sortOrder: 0 },
        { unitId: "post-1", language: "en", isPrimary: false, sortOrder: 1 },
      ],
      translations: [{ language: "en" }],
      contentTranslations: [{ language: "en" }],
    })) as any,
    getContentUnit: mock(async () => ({
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
    })) as any,
  };
}

async function createService(): Promise<UnitLanguageService> {
  const { UnitLanguageService } = await import("./language-resolution");
  return new UnitLanguageService(createRepository());
}

describe("UnitLanguageService.content", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("resolves supported but missing language rows to null fields", async () => {
    const service = await createService();

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
  test("normalizes app, request, and user candidates without adding fallback", async () => {
    const { resolveEffectiveReadLanguageCandidates } = await import(
      "./language-resolution"
    );

    expect(
      resolveEffectiveReadLanguageCandidates({
        languages: "ja, en",
        actorSettings: { preferredLanguages: ["zh-Hant", "en"] },
        appLocale: "ko",
      }),
    ).toEqual(["ko", "ja", "en", "zh-hant"]);
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

describe("UnitLanguageService.unitsMissingSupportLanguageRows", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("flags Unit and content translation rows without matching support languages", async () => {
    const service = await createService();

    await expect(service.unitsMissingSupportLanguageRows()).resolves.toEqual([
      {
        unitId: "post-1",
        language: "ja",
        source: "unit_translation",
      },
      {
        unitId: "post-1",
        language: "ja",
        source: "content_translation",
      },
    ]);

    expect(unitsMissingSupportLanguageRows).toHaveBeenCalledWith(100);
  });

  test("clamps diagnostic query limits", async () => {
    const service = await createService();

    await service.unitsMissingSupportLanguageRows(0);
    await service.unitsMissingSupportLanguageRows(10_000);

    expect(unitsMissingSupportLanguageRows.mock.calls[0]?.[0]).toBe(1);
    expect(unitsMissingSupportLanguageRows.mock.calls[1]?.[0]).toBe(500);
  });
});

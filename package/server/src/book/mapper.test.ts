import { describe, expect, mock, test } from "bun:test";

mock.module("@/unit/publication-policy", () => ({
  resolveStoredLicenseSlug: (value: unknown) => value,
}));

mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user,
}));

const { mapBaseBookToDTO } = await import("./mapper");

function bookRow(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "release-1",
    unit: {
      id: "release-1",
      userId: null,
      user: null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      aiDisclosureMode: "UNKNOWN",
      aiDisclosureDetails: null,
      licenseSlug: null,
      defaultLanguage: "en",
      isLanguageNeutral: false,
      catalogEntryKind: "MAIN",
      targetUnitId: null,
      referenceCount: 0,
      shareCount: 0,
      supportLanguages: [
        { unitId: "release-1", language: "en", isPrimary: true, sortOrder: 0 },
      ],
      translations: [],
      creditAttributions: [],
      publishedAt: null,
    },
    isbn13: null,
    publicationDate: null,
    pageCount: null,
    textLength: 0,
    chapterCount: 0,
    formatKey: null,
    isLicensed: false,
    extra: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("mapBaseBookToDTO", () => {
  test("omits internal metadata", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
        },
      }),
    );

    expect("metadata" in dto).toBe(false);
  });

  test("projects AI disclosure metadata independently from rating", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          rating: "GENERAL",
          aiDisclosureMode: "MACHINE_GENERATED",
          aiDisclosureDetails: { provider: "OpenAI", reviewedByHuman: true },
        },
      }),
    );

    expect(dto.rating).toBe("GENERAL");
    expect(dto.aiDisclosureMode).toBe("MACHINE_GENERATED");
    expect(dto.aiDisclosureDetails).toEqual({
      provider: "OpenAI",
      reviewedByHuman: true,
    });
  });

  test("projects catalog entry context from the owning Unit", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          catalogEntryKind: "VARIANT",
          targetUnitId: "main-1",
        },
      }),
    );

    expect(dto.catalogEntryKind).toBe("VARIANT");
    expect(dto.targetUnitId).toBe("main-1");
  });

  test("projects materialized count fields from the owning Unit", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          referenceCount: 6,
          shareCount: 7,
        },
      }),
    );

    expect(dto.referenceCount).toBe(6);
    expect(dto.shareCount).toBe(7);
  });

  test("does not fall back to another translation after resolving a supported language", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          supportLanguages: [
            {
              unitId: "release-1",
              language: "ja",
              isPrimary: true,
              sortOrder: 0,
            },
            {
              unitId: "release-1",
              language: "en",
              isPrimary: false,
              sortOrder: 1,
            },
          ],
          translations: [
            {
              unitId: "release-1",
              language: "en",
              title: "English title",
              summary: "English summary",
              extra: { coverUrl: "https://cdn.example/en.jpg" },
            },
          ],
        },
      }),
      ["ja", "en"],
    );

    expect(dto.resolvedLanguage).toBe("ja");
    expect(dto.title).toBeNull();
    expect(dto.summary).toBeNull();
    expect(dto.coverUrl).toBe("https://cdn.example/en.jpg");
  });

  test("prefers the resolved language cover when that translation has one", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          supportLanguages: [
            {
              unitId: "release-1",
              language: "ja",
              isPrimary: true,
              sortOrder: 0,
            },
            {
              unitId: "release-1",
              language: "en",
              isPrimary: false,
              sortOrder: 1,
            },
          ],
          translations: [
            {
              unitId: "release-1",
              language: "en",
              title: "English title",
              extra: { coverUrl: "https://cdn.example/en.jpg" },
            },
            {
              unitId: "release-1",
              language: "ja",
              title: null,
              extra: { coverUrl: "https://cdn.example/ja.jpg" },
            },
          ],
        },
      }),
      ["ja", "en"],
    );

    expect(dto.resolvedLanguage).toBe("ja");
    expect(dto.title).toBeNull();
    expect(dto.coverUrl).toBe("https://cdn.example/ja.jpg");
  });

  test("app locale outranks read fallback candidates", () => {
    const dto = mapBaseBookToDTO(
      bookRow({
        unit: {
          ...bookRow().unit,
          supportLanguages: [
            {
              unitId: "release-1",
              language: "en",
              isPrimary: true,
              sortOrder: 0,
            },
            {
              unitId: "release-1",
              language: "zh-hant",
              isPrimary: false,
              sortOrder: 1,
            },
          ],
          translations: [
            { unitId: "release-1", language: "en", title: "English title" },
            {
              unitId: "release-1",
              language: "zh-hant",
              title: "中文標題",
            },
          ],
        },
      }),
      { appLocale: "zh-hant", languages: ["en"] },
    );

    expect(dto.resolvedLanguage).toBe("zh-hant");
    expect(dto.title).toBe("中文標題");
  });
});

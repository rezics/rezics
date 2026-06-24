import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import type { UnitWithRelations } from "./types";

mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user,
  publicUserSelect: {},
}));

mock.module("./publication-policy", () => ({
  resolveStoredLicenseSlug: (value: unknown) => value,
}));

const { mapUnitListItemToDTO } = await import("./mapper");

const baseUnit = {
  id: "book-1",
  type: "BOOK",
  slug: null,
  userId: "user-1",
  user: null,
  isLanguageNeutral: false,
  status: "PUBLISHED",
  visibility: "PUBLIC",
  rating: "GENERAL",
  aiDisclosureMode: "NONE",
  aiDisclosureDetails: null,
  licenseSlug: null,
  extra: null,
  createdAt: new Date("2026-06-03T00:00:00.000Z"),
  updatedAt: new Date("2026-06-03T00:00:00.000Z"),
  publishedAt: null,
  referenceCount: 7,
  shareCount: 8,
  supportLanguages: [
    { unitId: "book-1", language: "ja", isPrimary: true, position: "a" },
    { unitId: "book-1", language: "en", isPrimary: false, position: "b" },
  ],
  translations: [
    {
      unitId: "book-1",
      language: "en",
      title: "English title",
      subtitle: "English subtitle",
      summary: "English summary",
      description: markdownContentDoc("English description"),
      extra: null,
      sourceUnitId: null,
      createdAt: new Date("2026-06-03T00:00:00.000Z"),
      updatedAt: new Date("2026-06-03T00:00:00.000Z"),
    },
  ],
} as unknown as UnitWithRelations;

describe("mapUnitListItemToDTO", () => {
  test("returns one supported-language preview without full language rows", () => {
    const dto = mapUnitListItemToDTO(baseUnit, ["ja", "en"]);

    expect(dto.resolvedLanguage).toBe("ja");
    expect(dto.title).toBeNull();
    expect(dto.description).toBeNull();
    expect(dto.referenceCount).toBe(7);
    expect(dto.shareCount).toBe(8);
    expect("translations" in dto).toBe(false);
    expect("supportLanguages" in dto).toBe(false);
  });

  test("app locale outranks read fallback candidates", () => {
    const dto = mapUnitListItemToDTO(
      {
        ...baseUnit,
        supportLanguages: [
          { unitId: "book-1", language: "en", isPrimary: true, position: "a" },
          {
            unitId: "book-1",
            language: "zh-hant",
            isPrimary: false,
            position: "b",
          },
        ],
        translations: [
          ...(baseUnit.translations ?? []),
          {
            unitId: "book-1",
            language: "zh-hant",
            title: "中文標題",
            subtitle: null,
            summary: null,
            description: markdownContentDoc("中文介紹"),
            extra: null,
            sourceUnitId: null,
            createdAt: new Date("2026-06-03T00:00:00.000Z"),
            updatedAt: new Date("2026-06-03T00:00:00.000Z"),
          },
        ],
      } as UnitWithRelations,
      { appLocale: "zh-hant", languages: ["en"] },
    );

    expect(dto.resolvedLanguage).toBe("zh-hant");
    expect(dto.title).toBe("中文標題");
  });
});

import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";

mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageInput: (input: unknown) => input,
  resolveEffectiveReadLanguageCandidates: () => [],
}));
mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user,
}));

const { mapRealmListRowToDTO, mapRealmToDTO } = await import("./realm.mapper");

function realmRow(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "realm-1",
    isPublic: true,
    isOfficial: false,
    contentRequiresApproval: false,
    memberCount: 1,
    extra: null,
    createdAt: new Date("2026-06-03T00:00:00.000Z"),
    updatedAt: new Date("2026-06-03T00:00:00.000Z"),
    unit: {
      id: "realm-1",
      slug: "realm",
      userId: null,
      user: null,
      supportLanguages: [
        { unitId: "realm-1", language: "ja", isPrimary: true, position: "a" },
        { unitId: "realm-1", language: "en", isPrimary: false, position: "b" },
      ],
      translations: [
        {
          unitId: "realm-1",
          language: "en",
          title: "English realm",
          description: markdownContentDoc("English description"),
        },
      ],
    },
    members: [],
    ...overrides,
  } as any;
}

describe("realm mappers", () => {
  test("detail resolution keeps missing resolved-language fields null", () => {
    const dto = mapRealmToDTO(realmRow(), ["ja", "en"]);

    expect(dto.resolvedLanguage).toBe("ja");
    expect(dto.title).toBeNull();
    expect(dto.description).toBeNull();
  });

  test("list resolution uses the same support-language candidates", () => {
    const dto = mapRealmListRowToDTO(realmRow(), ["en", "ja"]);

    expect(dto.resolvedLanguage).toBe("en");
    expect(dto.title).toBe("English realm");
    expect(dto.description).toEqual(markdownContentDoc("English description"));
  });

  test("language-neutral realms still resolve display from support languages", () => {
    const dto = mapRealmToDTO(
      realmRow({
        unit: {
          ...realmRow().unit,
          isLanguageNeutral: true,
        },
      }),
      ["ja", "en"],
    );

    expect(dto.resolvedLanguage).toBe("ja");
    expect(dto.title).toBeNull();
  });

  test("app locale outranks read fallback candidates", () => {
    const dto = mapRealmToDTO(
      realmRow({
        unit: {
          ...realmRow().unit,
          supportLanguages: [
            {
              unitId: "realm-1",
              language: "en",
              isPrimary: true,
              position: "a",
            },
            {
              unitId: "realm-1",
              language: "zh-hant",
              isPrimary: false,
              position: "b",
            },
          ],
          translations: [
            {
              unitId: "realm-1",
              language: "en",
              title: "English realm",
              description: markdownContentDoc("English description"),
            },
            {
              unitId: "realm-1",
              language: "zh-hant",
              title: "中文領域",
              description: markdownContentDoc("中文介紹"),
            },
          ],
        },
      }),
      { appLocale: "zh-hant", languages: ["en"] },
    );

    expect(dto.resolvedLanguage).toBe("zh-hant");
    expect(dto.title).toBe("中文領域");
  });
});

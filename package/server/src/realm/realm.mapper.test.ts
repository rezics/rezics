import { describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { mapRealmListRowToDTO, mapRealmToDTO } from "./realm.mapper";

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
        { unitId: "realm-1", language: "ja", isPrimary: true, sortOrder: 0 },
        { unitId: "realm-1", language: "en", isPrimary: false, sortOrder: 1 },
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
});

import { describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { mapShelfListRowToDTO } from "./shelf.mapper";

function shelfRow(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "shelf-1",
    extra: null,
    rootItemCount: 0,
    itemCount: 1,
    createdAt: new Date("2026-06-15T00:00:00.000Z"),
    updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    unit: {
      id: "shelf-1",
      slug: null,
      userId: "user-1",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      licenseSlug: null,
      defaultLanguage: "zh-hant",
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
      user: null,
      supportLanguages: [
        {
          unitId: "shelf-1",
          language: "zh-hant",
          isPrimary: true,
          position: "a",
        },
        {
          unitId: "shelf-1",
          language: "en",
          isPrimary: false,
          position: "b",
        },
      ],
      translations: [
        {
          unitId: "shelf-1",
          language: "zh-hant",
          title: null,
          subtitle: null,
          summary: null,
          description: null,
          extra: null,
        },
        {
          unitId: "shelf-1",
          language: "en",
          title: "English Shelf",
          subtitle: null,
          summary: null,
          description: markdownContentDoc("English description"),
          extra: { coverUrl: "s3://bucket/shelf-en.webp" },
        },
      ],
      unitTags: [],
    },
    ...overrides,
  } as any;
}

describe("shelf mapper language display", () => {
  test("does not fill missing fields from another language after resolving a language", () => {
    const dto = mapShelfListRowToDTO(shelfRow(), null, {
      languages: ["zh-hant", "en"],
    });

    expect(dto.resolvedLanguage).toBe("zh-hant");
    expect(dto.title).toBeNull();
    expect(dto.description).toBeNull();
    expect(dto.coverUrl).toBeNull();
    expect(dto.translations?.map((item) => item.language)).toEqual([
      "zh-hant",
      "en",
    ]);
  });

  test("falls back to content language priority when preferences do not match", () => {
    const dto = mapShelfListRowToDTO(shelfRow(), null, {
      languages: ["ko", "de"],
    });

    expect(dto.resolvedLanguage).toBe("zh-hant");
    expect(dto.title).toBeNull();
  });

  test("reads display fields from the resolved translation row", () => {
    const dto = mapShelfListRowToDTO(shelfRow(), null, {
      languages: ["en", "zh-hant"],
    });

    expect(dto.resolvedLanguage).toBe("en");
    expect(dto.title).toBe("English Shelf");
    expect(dto.description).toEqual(markdownContentDoc("English description"));
    expect(dto.coverUrl).toBe("s3://bucket/shelf-en.webp");
  });
});

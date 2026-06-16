import { describe, expect, test } from "bun:test";
import { buildLabelDocument, buildTagDocument } from "./sync";

const baseUnit = {
  id: "unit-1",
  slug: "shared",
  status: "PUBLISHED",
  isLanguageNeutral: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  supportLanguages: [],
  aliases: [
    {
      value: "alias visible",
      status: "ACTIVE",
      score: 1,
      pinned: false,
    },
    {
      value: "alias hidden",
      status: "ACTIVE",
      score: -101,
      pinned: false,
    },
  ],
};

describe("tag and label search documents", () => {
  test("tag documents derive searchable languages from translations", () => {
    const doc = buildTagDocument({
      ...baseUnit,
      translations: [
        {
          language: "zh-hant",
          title: "奇幻",
          description: { type: "doc", content: [{ type: "paragraph" }] },
        },
        { language: "en", title: "Fantasy", description: null },
      ],
    });

    expect(doc.id).toBe("unit-1");
    expect(doc.titles).toEqual(["奇幻", "Fantasy"]);
    expect(doc.languages).toEqual(["zh-hant", "en"]);
    expect(doc.aliasValues).toEqual(["alias visible"]);
    expect(doc.isLanguageNeutral).toBe(true);
  });

  test("label documents are global i18n references without realm or zone scope", () => {
    const doc = buildLabelDocument({
      ...baseUnit,
      id: "label-1",
      translations: [
        { language: "zh-hant", title: "角色" },
        { language: "en", title: "Characters" },
      ],
    });

    expect(doc).toMatchObject({
      id: "label-1",
      unitId: "label-1",
      titles: ["角色", "Characters"],
      languages: ["zh-hant", "en"],
      status: "PUBLISHED",
    });
    expect("realmUnitId" in doc).toBe(false);
    expect("zoneUnitId" in doc).toBe(false);
  });
});

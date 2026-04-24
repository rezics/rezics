import { describe, expect, test } from "bun:test";
import { mapPinboardEntryDTO, resolveTranslationInline } from "../pinboard.mapper";
import type { PinboardUnitRow } from "../pinboard.types";

function buildUnit(overrides: Partial<PinboardUnitRow>): PinboardUnitRow {
  const now = new Date();
  return {
    id: "u1",
    type: "POST" as const,
    workUnitId: null,
    userId: "author-1",
    defaultLanguage: "zh-hans",
    isLanguageNeutral: false,
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    rating: "GENERAL" as const,
    extra: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    slug: null,
    translationGroupId: null,
    translations: [],
    post: {
      unitId: "u1",
      authorUserId: "author-1",
      targetUnitId: null,
      realmUnitId: "realm-1",
      scoreEntryId: null,
      body: "body",
      rootPostUnitId: null,
      parentPostUnitId: null,
      kind: null,
      depth: 0,
      sortPath: null,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      extra: null,
      createdAt: now,
      updatedAt: now,
    },
    translationGroup: null,
    ...overrides,
  } as PinboardUnitRow;
}

describe("resolveTranslationInline", () => {
  test("prefers the requested language", () => {
    const unit = buildUnit({
      defaultLanguage: "zh-hans",
      translations: [
        buildTr("zh-hans", "中文"),
        buildTr("en", "english"),
      ],
    });
    const tr = resolveTranslationInline(unit, "en");
    expect(tr?.language).toBe("en");
  });

  test("falls back to unit default language", () => {
    const unit = buildUnit({
      defaultLanguage: "zh-hans",
      translations: [
        buildTr("zh-hans", "中文"),
        buildTr("en", "english"),
      ],
    });
    const tr = resolveTranslationInline(unit, "ja");
    expect(tr?.language).toBe("zh-hans");
  });

  test("falls back to platform en when default language is absent", () => {
    const unit = buildUnit({
      defaultLanguage: "ja",
      translations: [buildTr("en", "english"), buildTr("de", "deutsch")],
    });
    const tr = resolveTranslationInline(unit, "zh-hant");
    expect(tr?.language).toBe("en");
  });

  test("falls back to first-available when nothing else matches", () => {
    const unit = buildUnit({
      defaultLanguage: "ja",
      translations: [buildTr("de", "deutsch")],
    });
    const tr = resolveTranslationInline(unit, "zh-hant");
    expect(tr?.language).toBe("de");
  });
});

describe("mapPinboardEntryDTO", () => {
  test("exposes supportedLanguages from the group, or falls back to default language", () => {
    const unit = buildUnit({
      defaultLanguage: "zh-hans",
      translations: [buildTr("zh-hans", "t")],
    });
    const entry = mapPinboardEntryDTO(unit, {
      realmUnitId: "realm-1",
      pinboardKey: "announcement",
      position: 2,
    });
    expect(entry.supportedLanguages).toEqual(["zh-hans"]);
    expect(entry.position).toBe(2);
  });

  test("pulls group supported languages when present", () => {
    const unit = buildUnit({
      defaultLanguage: "zh-hans",
      translationGroupId: "g1",
      translationGroup: {
        id: "g1",
        supportedLanguages: ["zh-hans", "en", "ja"],
      } as PinboardUnitRow["translationGroup"],
      translations: [buildTr("zh-hans", "t")],
    });
    const entry = mapPinboardEntryDTO(unit, {
      realmUnitId: "r",
      pinboardKey: "pinned",
      position: 0,
    });
    expect(entry.supportedLanguages).toEqual(["zh-hans", "en", "ja"]);
  });
});

function buildTr(language: string, title: string): PinboardUnitRow["translations"][number] {
  const now = new Date();
  return {
    unitId: "u1",
    language,
    title,
    subtitle: null,
    summary: null,
    description: null,
    extra: null,
    sourceReleaseUnitId: null,
    createdAt: now,
    updatedAt: now,
  } as PinboardUnitRow["translations"][number];
}

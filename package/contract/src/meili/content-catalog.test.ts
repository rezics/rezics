import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  ContentSearchDocumentSchema,
  ContentSearchOptionsSchema,
} from "./content";

const baseContentDocument = {
  id: "release-1",
  type: "BOOK",
  titles: ["Release"],
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
  tagLabels: ["Own", "Work"],
  aliasValues: [],
  tagIds: ["tag-own"],
  tagScores: { "tag-own": 1 },
  catalogEntryKind: "MAIN",
  targetUnitId: null,
  seriesUnitIds: [],
  seriesKindKeys: [],
  seriesTitles: [],
  realmIds: [],
  realmTagKeys: [],
  languages: ["en"],
  isLanguageNeutral: false,
  rating: "GENERAL",
  aiDisclosureMode: "UNKNOWN",
  visibility: "PUBLIC",
  isLicensed: false,
  postKind: null,
  textLength: 100,
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
  publishedAt: null,
  bestScore: 0,
  hotScore: 0,
  topScore: 0,
  risingScore: 0,
  controversyScore: 0,
  trendingScore: 0,
  qualityScore: 0,
  rankUpdatedAt: null,
  referenceCount: 0,
  shareCount: 0,
  defaultLanguage: "en",
  coverUrl: null,
  userId: null,
};

describe("ContentSearchDocumentSchema catalog fields", () => {
  test("accepts catalog identity projection fields", () => {
    expect(Value.Check(ContentSearchDocumentSchema, baseContentDocument)).toBe(
      true,
    );
  });

  test("accepts standalone documents without legacy search grouping", () => {
    expect(
      Value.Check(ContentSearchDocumentSchema, {
        ...baseContentDocument,
        id: "standalone-1",
        aiDisclosureMode: "AI_ASSISTED",
        catalogEntryKind: "NONE",
        seriesUnitIds: ["series-1"],
        seriesKindKeys: ["book_series"],
        seriesTitles: ["Series"],
      }),
    ).toBe(true);
    expect("translationGroupId" in ContentSearchDocumentSchema.properties).toBe(
      false,
    );
  });

  test("accepts grouped and expanded catalog release search options", () => {
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        releasePresentation: "grouped",
        tagIds: ["tag-work"],
      }),
    ).toBe(true);
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        releasePresentation: "expanded",
        catalogEntryKind: "VARIANT",
        targetUnitId: "release-1",
        seriesUnitIds: ["series-1"],
        seriesKindKeys: ["book_series"],
        subjectEntityIds: ["entity-1"],
        subjectKinds: ["character"],
        subjectRoles: ["primary_character"],
        aiDisclosureModes: ["AI_ASSISTED"],
      }),
    ).toBe(true);
    expect("translationGroupIds" in ContentSearchOptionsSchema.properties).toBe(
      false,
    );
  });

  test("documents exact shelf containment and catalog option names", () => {
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        containedUnitIds: ["release-1"],
      }),
    ).toBe(true);
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        catalogEntryKind: "VARIANT",
        targetUnitId: "main-1",
      }),
    ).toBe(true);
  });
});

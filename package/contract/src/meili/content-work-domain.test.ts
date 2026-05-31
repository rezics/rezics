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
  workUnitId: "work-1",
  catalogEntryKind: "MAIN",
  targetUnitId: null,
  seriesUnitIds: [],
  seriesKindKeys: [],
  seriesTitles: [],
  realmIds: [],
  translationGroupId: null,
  realmTagKeys: [],
  languages: ["en"],
  rating: "GENERAL",
  aiDisclosureMode: "UNKNOWN",
  visibility: "PUBLIC",
  isLicensed: false,
  postKind: null,
  textLength: 100,
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
  publishedAt: null,
  hotScore: 0,
  topScore: 0,
  trendingScore: 0,
  qualityScore: 0,
  rankUpdatedAt: null,
  defaultLanguage: "en",
  coverUrl: null,
  userId: null,
};

describe("ContentSearchDocumentSchema work-domain fields", () => {
  test("accepts legacy work membership projection fields", () => {
    expect(Value.Check(ContentSearchDocumentSchema, baseContentDocument)).toBe(
      true,
    );
  });

  test("accepts standalone documents without legacy search grouping", () => {
    expect(
      Value.Check(ContentSearchDocumentSchema, {
        ...baseContentDocument,
        id: "standalone-1",
        workUnitId: null,
        aiDisclosureMode: "AI_ASSISTED",
        catalogEntryKind: "NONE",
        seriesUnitIds: ["series-1"],
        seriesKindKeys: ["book_series"],
        seriesTitles: ["Series"],
        translationGroupId: "tg-1",
      }),
    ).toBe(true);
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
        workUnitId: "work-1",
        catalogEntryKind: "VARIANT",
        targetUnitId: "release-1",
        seriesUnitIds: ["series-1"],
        seriesKindKeys: ["book_series"],
        subjectEntityIds: ["entity-1"],
        subjectKinds: ["character"],
        subjectRoles: ["primary_character"],
        translationGroupIds: ["tg-1"],
        aiDisclosureModes: ["AI_ASSISTED"],
      }),
    ).toBe(true);
  });

  test("documents exact shelf containment and catalog option names", () => {
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        containedUnitIds: ["release-1"],
      }),
    ).toBe(true);
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        workUnitId: "work-1",
        catalogEntryKind: "VARIANT",
        targetUnitId: "main-1",
      }),
    ).toBe(true);
  });
});

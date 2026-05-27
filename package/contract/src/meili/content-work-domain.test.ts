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
  searchGroupId: "work-1",
  ownTagIds: ["tag-own"],
  workTagIds: ["tag-work"],
  allTagIds: ["tag-own", "tag-work"],
  ownTagLabels: ["Own"],
  workTagLabels: ["Work"],
  allTagLabels: ["Own", "Work"],
  position: "a0",
  displayPolicy: "PRIMARY",
  workUnitIds: ["work-1"],
  workRoles: ["RELEASE"],
  realmIds: [],
  realmTagKeys: [],
  languages: ["en"],
  rating: "GENERAL",
  visibility: "PUBLIC",
  isLicensed: false,
  postKind: null,
  textLength: 100,
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
  publishedAt: null,
  defaultLanguage: "en",
  coverUrl: null,
  userId: null,
};

describe("ContentSearchDocumentSchema work-domain fields", () => {
  test("accepts inherited work tag projection fields", () => {
    expect(Value.Check(ContentSearchDocumentSchema, baseContentDocument)).toBe(
      true,
    );
  });

  test("accepts standalone documents grouped by themselves", () => {
    expect(
      Value.Check(ContentSearchDocumentSchema, {
        ...baseContentDocument,
        id: "standalone-1",
        workUnitId: null,
        searchGroupId: "standalone-1",
        ownTagIds: [],
        workTagIds: [],
        allTagIds: [],
        ownTagLabels: [],
        workTagLabels: [],
        allTagLabels: [],
        position: null,
        displayPolicy: null,
        workUnitIds: [],
        workRoles: [],
      }),
    ).toBe(true);
  });

  test("accepts grouped and expanded release search options", () => {
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        releasePresentation: "grouped",
        allTagIds: ["tag-work"],
      }),
    ).toBe(true);
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        releasePresentation: "expanded",
        workUnitId: "work-1",
        workRoles: ["RELEASE"],
      }),
    ).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import type { ContentSearchDocument } from "@rezics/contract";
import {
  creationWorkMatchCopy,
  resolveCreationWorkMatchContext,
} from "./creationWorkMatch";

function searchDoc(
  partial: Partial<ContentSearchDocument>,
): ContentSearchDocument {
  return {
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
    tagLabels: [],
    aliasValues: [],
    tagIds: [],
    tagScores: {},
    catalogEntryKind: "MAIN",
    targetUnitId: null,
    realmIds: [],
    realmTagKeys: [],
    languages: ["en"],
    rating: "GENERAL",
    visibility: "PUBLIC",
    isLicensed: true,
    postKind: null,
    textLength: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: null,
    defaultLanguage: "en",
    coverUrl: null,
    userId: null,
    ...partial,
  };
}

describe("creationWorkMatchCopy", () => {
  test("uses prominent guidance for public catalog creation", () => {
    expect(creationWorkMatchCopy("wiki")).toMatchObject({
      title: "Find an existing catalog entry first",
      prominent: true,
    });
  });

  test("uses quieter guidance for personal creation", () => {
    expect(creationWorkMatchCopy("personal")).toMatchObject({
      title: "Work row",
      prominent: false,
    });
  });
});

describe("resolveCreationWorkMatchContext", () => {
  test("disambiguates variants that point at a catalog target", () => {
    expect(
      resolveCreationWorkMatchContext(
        searchDoc({
          catalogEntryKind: "VARIANT",
          targetUnitId: "main-1",
          collapsedAlternativeUnitIds: ["release-2", "release-3"],
          tagLabels: ["mystery", "translation"],
        }),
      ),
    ).toEqual({
      releaseUnitId: "release-1",
      title: "Release",
      targetUnitId: "main-1",
      isVariant: true,
      relatedReleaseCount: 3,
      tagSummary: ["mystery", "translation"],
    });
  });

  test("uses main catalog entries as their own interaction target", () => {
    expect(resolveCreationWorkMatchContext(searchDoc({}))).toMatchObject({
      targetUnitId: "release-1",
      isVariant: false,
      relatedReleaseCount: 1,
    });
  });
});

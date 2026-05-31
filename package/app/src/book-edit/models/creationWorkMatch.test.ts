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
    workUnitId: null,
    position: null,
    displayPolicy: null,
    workUnitIds: [],
    workRoles: [],
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
      title: "Find an existing work first",
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
  test("disambiguates matched releases that already belong to a work", () => {
    expect(
      resolveCreationWorkMatchContext(
        searchDoc({
          workUnitId: "work-1",
          collapsedAlternativeUnitIds: ["release-2", "release-3"],
          tagLabels: ["mystery", "translation"],
        }),
      ),
    ).toEqual({
      releaseUnitId: "release-1",
      title: "Release",
      workUnitId: "work-1",
      createsHiddenWork: false,
      sameWorkReleaseCount: 3,
      workTagSummary: ["mystery", "translation"],
    });
  });

  test("marks standalone matched releases for hidden work-domain creation", () => {
    expect(
      resolveCreationWorkMatchContext(searchDoc({ workUnitId: null })),
    ).toMatchObject({
      workUnitId: null,
      createsHiddenWork: true,
      sameWorkReleaseCount: 1,
    });
  });
});

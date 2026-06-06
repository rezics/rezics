import { beforeEach, describe, expect, mock, test } from "bun:test";

type ContentSearchHit = any;

const contentSearchMock = mock(
  async (
    _query: string,
    _params: any,
  ): Promise<{
    hits: ContentSearchHit[];
    estimatedTotalHits: number;
    processingTimeMs: number;
    query: string;
  }> => ({
    hits: [],
    estimatedTotalHits: 0,
    processingTimeMs: 1,
    query: _query,
  }),
);

mock.module("../search-client", () => ({
  searchClient: {
    contentIndex: {
      search: contentSearchMock,
    },
  },
}));

mock.module("../../shared/slug-ref", () => ({
  resolveSlugRefs: mock(async () => []),
}));

const { searchContent } = await import("./content.service");

describe("searchContent catalog behavior", () => {
  beforeEach(() => {
    contentSearchMock.mockClear();
    contentSearchMock.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 1,
      query: "",
    });
  });

  test("filters direct tags and catalog identity", async () => {
    await searchContent({
      tagIds: ["tag-esrb-teen"],
      catalogEntryKind: "VARIANT",
      targetUnitId: "main-entry-1",
      platformEntityIds: ["platform-windows"],
    });

    expect(contentSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'tagIds = "tag-esrb-teen"',
      'catalogEntryKind = "VARIANT"',
      'targetUnitId = "main-entry-1"',
      'platformEntityIds = "platform-windows"',
      'visibility = "PUBLIC"',
    ]);
  });

  test("filters wiki section subject selectors without translation grouping", async () => {
    await searchContent({
      type: "POST",
      postKind: ["WIKI"],
      realmId: "realm-1",
      subjectEntityIds: ["entity-1", "entity-2"],
      subjectKinds: ["character"],
      subjectRoles: ["primary_character", "supporting_character"],
    });

    expect(contentSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'type = "POST"',
      'postKind = "WIKI"',
      '(subjectEntityIds = "entity-1" OR subjectEntityIds = "entity-2")',
      'subjectKinds = "character"',
      '(subjectRoles = "primary_character" OR subjectRoles = "supporting_character")',
      'realmIds = "realm-1"',
      'visibility = "PUBLIC"',
    ]);
  });

  test("defaults edition-capable type searches to main catalog entries", async () => {
    await searchContent({
      type: ["BOOK", "GAME"],
    });

    expect(contentSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'type IN ["BOOK", "GAME"]',
      'catalogEntryKind = "MAIN"',
      'visibility = "PUBLIC"',
    ]);
  });

  test("exact variant lookup does not add the main catalog default", async () => {
    await searchContent({
      type: "BOOK",
      targetUnitId: "main-entry-1",
    });

    expect(contentSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'type = "BOOK"',
      'targetUnitId = "main-entry-1"',
      'visibility = "PUBLIC"',
    ]);
  });

  test("filters realm-scoped wiki listings with tag and realm tag selectors", async () => {
    await searchContent({
      type: "POST",
      postKind: ["WIKI"],
      realmId: "realm-1",
      tagIds: ["tag-lore"],
      realmTagIds: ["tag-featured", "tag-canon"],
    });

    expect(contentSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'type = "POST"',
      'postKind = "WIKI"',
      'tagIds = "tag-lore"',
      'realmIds = "realm-1"',
      '(realmTagKeys = "realm-1:tag-featured" OR realmTagKeys = "realm-1:tag-canon")',
      'visibility = "PUBLIC"',
    ]);
  });

  test("filters multiple languages with any-of semantics", async () => {
    await searchContent({
      languages: ["ja", "en"],
    });

    expect(contentSearchMock.mock.calls[0]?.[1].filter).toContain(
      '(isLanguageNeutral = true OR languages IN ["ja", "en"])',
    );
  });

  test("resolves display fields from the chosen read language", async () => {
    contentSearchMock.mockResolvedValueOnce({
      hits: [
        {
          id: "book-1",
          catalogEntryKind: "MAIN",
          targetUnitId: null,
          isLanguageNeutral: false,
          supportLanguages: [
            { language: "ja", isPrimary: true, sortOrder: 0 },
            { language: "en", isPrimary: false, sortOrder: 1 },
          ],
          translations: [
            {
              language: "ja",
              title: null,
              subtitle: null,
              summary: null,
              description: null,
            },
            {
              language: "en",
              title: "English title",
              subtitle: null,
              summary: "English summary",
              description: null,
            },
          ],
        },
      ],
      estimatedTotalHits: 1,
      processingTimeMs: 1,
      query: "",
    });

    const result = await searchContent({ languages: ["ja", "en"] });

    expect(result.items[0]).toMatchObject({
      resolvedLanguage: "ja",
      title: null,
      summary: null,
    });
  });

  test("groups catalog variant hits and exposes collapsed alternatives", async () => {
    contentSearchMock.mockResolvedValueOnce({
      hits: [
        {
          id: "release-secondary",
          catalogEntryKind: "VARIANT",
          targetUnitId: "release-primary",
        },
        {
          id: "release-primary",
          catalogEntryKind: "MAIN",
          targetUnitId: null,
        },
        {
          id: "standalone",
          catalogEntryKind: "NONE",
          targetUnitId: null,
        },
      ],
      estimatedTotalHits: 3,
      processingTimeMs: 1,
      query: "",
    });

    const result = await searchContent({
      releasePresentation: "grouped",
      limit: 10,
    });

    expect(contentSearchMock.mock.calls[0]?.[1].limit).toBe(30);
    expect(result.items.map((item: any) => item.id)).toEqual([
      "release-primary",
      "standalone",
    ]);
    expect((result.items[0] as any).collapsedAlternativeUnitIds).toEqual([
      "release-secondary",
    ]);
  });

  test("expanded release presentation returns raw hits", async () => {
    contentSearchMock.mockResolvedValueOnce({
      hits: [
        {
          id: "release-primary",
          catalogEntryKind: "MAIN",
          targetUnitId: null,
        },
        {
          id: "release-secondary",
          catalogEntryKind: "VARIANT",
          targetUnitId: "release-primary",
        },
      ],
      estimatedTotalHits: 2,
      processingTimeMs: 1,
      query: "",
    });

    const result = await searchContent({
      releasePresentation: "expanded",
      limit: 10,
    });

    expect(contentSearchMock.mock.calls[0]?.[1].limit).toBe(10);
    expect(result.items.map((item: any) => item.id)).toEqual([
      "release-primary",
      "release-secondary",
    ]);
  });
});

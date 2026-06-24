import { beforeEach, describe, expect, mock, test } from "bun:test";

const postSearchMock = mock(
  async (_query: string, _params: any): Promise<any> => ({
    hits: [],
    estimatedTotalHits: 0,
    processingTimeMs: 1,
    query: _query,
  }),
);

mock.module("../search-client", () => ({
  searchClient: {
    postIndex: {
      search: postSearchMock,
    },
  },
}));

const { searchPosts } = await import("./post.service");

describe("searchPosts filters", () => {
  beforeEach(() => {
    postSearchMock.mockClear();
    postSearchMock.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 1,
      query: "",
    });
  });

  test("combines exact target, variant context, and realm filters", async () => {
    await searchPosts({
      targetUnitId: "release-1",
      variantUnitId: "variant-1",
      realmUnitId: "realm-1",
    });

    expect(postSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'targetUnitId = "release-1"',
      'variantUnitId = "variant-1"',
      'realmIds = "realm-1"',
    ]);
  });

  test("filters preferred post languages before pagination", async () => {
    await searchPosts({
      languages: ["ja"],
      appLocale: "en",
    });

    expect(postSearchMock.mock.calls[0]?.[1].filter).toEqual([
      '(isLanguageNeutral = true OR languages IN ["en", "ja"])',
    ]);
  });

  test("resolves post title and content from the chosen language only", async () => {
    postSearchMock.mockResolvedValueOnce({
      hits: [
        {
          id: "post-1",
          languages: ["ja", "en"],
          isLanguageNeutral: false,
          supportLanguages: [
            { language: "ja", isPrimary: true, position: "a" },
            { language: "en", isPrimary: false, position: "b" },
          ],
          translations: [
            { language: "ja", title: null, content: null },
            { language: "en", title: "English title", content: "English body" },
          ],
        },
      ],
      estimatedTotalHits: 1,
      processingTimeMs: 1,
      query: "",
    });

    const result = await searchPosts({ languages: ["ja", "en"] });

    expect(result.items[0]).toMatchObject({
      resolvedLanguage: "ja",
      title: null,
      content: null,
    });
  });
});

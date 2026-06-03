import { beforeEach, describe, expect, mock, test } from "bun:test";

const realmSearchMock = mock(async (_query: string, _params: any) => ({
  hits: [],
  estimatedTotalHits: 0,
  processingTimeMs: 1,
  query: _query,
}));

mock.module("../search-client", () => ({
  searchClient: {
    realmIndex: {
      search: realmSearchMock,
    },
  },
}));

const { searchRealms } = await import("./realm.service");

describe("searchRealms", () => {
  beforeEach(() => {
    realmSearchMock.mockClear();
    realmSearchMock.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 1,
      query: "",
    });
  });

  test("filters preferred realm languages before pagination", async () => {
    await searchRealms({ languages: ["ja"], appLocale: "en" });

    expect(realmSearchMock.mock.calls[0]?.[1].filter).toEqual([
      '(isLanguageNeutral = true OR languages IN ["ja", "en"])',
    ]);
  });

  test("resolves realm display fields from the chosen language only", async () => {
    realmSearchMock.mockResolvedValueOnce({
      hits: [
        {
          id: "realm-1",
          languages: ["ja", "en"],
          isLanguageNeutral: false,
          supportLanguages: [
            { language: "ja", isPrimary: true, sortOrder: 0 },
            { language: "en", isPrimary: false, sortOrder: 1 },
          ],
          translations: [
            { language: "ja", title: null, description: null },
            {
              language: "en",
              title: "English realm",
              description: "English description",
            },
          ],
        },
      ],
      estimatedTotalHits: 1,
      processingTimeMs: 1,
      query: "",
    });

    const result = await searchRealms({ languages: ["ja", "en"] });

    expect(result.items[0]).toMatchObject({
      resolvedLanguage: "ja",
      title: null,
      description: null,
    });
  });
});

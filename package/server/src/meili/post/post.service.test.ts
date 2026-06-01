import { beforeEach, describe, expect, mock, test } from "bun:test";

const postSearchMock = mock(async (_query: string, _params: any) => ({
  hits: [],
  estimatedTotalHits: 0,
  processingTimeMs: 1,
  query: _query,
}));

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
});

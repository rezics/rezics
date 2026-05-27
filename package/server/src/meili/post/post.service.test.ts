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

describe("searchPosts work-domain filters", () => {
  beforeEach(() => {
    postSearchMock.mockClear();
    postSearchMock.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 1,
      query: "",
    });
  });

  test("combines exact target and work-domain filters", async () => {
    await searchPosts({
      targetUnitId: "release-1",
      workUnitId: "work-1",
      workRoles: ["REVIEW"],
    });

    expect(postSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'targetUnitId = "release-1"',
      'workUnitIds = "work-1"',
      'workRoles = "REVIEW"',
    ]);
  });
});

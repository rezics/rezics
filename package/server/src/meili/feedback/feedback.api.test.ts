import { beforeEach, describe, expect, mock, test } from "bun:test";

const feedbackSearch = mock(async (_query: string, _options: any) => ({
  hits: [],
  totalHits: 0,
  processingTimeMs: 1,
  query: "",
}));

mock.module("../search-client", () => ({
  searchClient: {
    feedbackIndex: {
      search: feedbackSearch,
    },
  },
}));

describe("searchFeedbacks", () => {
  beforeEach(() => {
    feedbackSearch.mockClear();
  });

  test("builds filters for polymorphic feedback targets", async () => {
    const { searchFeedbacks } = await import("./feedback.api");

    await searchFeedbacks({
      q: "report",
      targetKind: "comment",
      targetId: "comment-1",
      addressedUnitId: "post-1",
      limit: 20,
    });

    expect(feedbackSearch).toHaveBeenCalledWith(
      "report",
      expect.objectContaining({
        filter: [
          'targetKind = "comment"',
          'targetId = "comment-1"',
          'addressedUnitId = "post-1"',
        ],
      }),
    );
  });
});

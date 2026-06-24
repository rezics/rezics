import { beforeEach, describe, expect, mock, test } from "bun:test";

const pollSearchMock = mock(async (_query: string, _params: any) => ({
  hits: [],
  estimatedTotalHits: 0,
  processingTimeMs: 1,
  query: _query,
}));

mock.module("../search-client", () => ({
  searchClient: {
    pollIndex: {
      search: pollSearchMock,
    },
  },
}));

const { searchPolls } = await import("./poll.service");

describe("searchPolls", () => {
  beforeEach(() => {
    pollSearchMock.mockClear();
    pollSearchMock.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 1,
      query: "",
    });
  });

  test("filters by owner, usage, and lifecycle for the reusable library", async () => {
    await searchPolls({
      keyword: "reading",
      ownerUserId: "user-1",
      used: false,
      closed: true,
      sort: { field: "usageCount", order: "asc" },
      offset: 10,
      limit: 5,
    });

    expect(pollSearchMock).toHaveBeenCalledWith("reading", {
      offset: 10,
      limit: 5,
      filter: ['ownerUserId = "user-1"', "used = false", "closed = true"],
      sort: ["usageCount:asc"],
    });
  });

  test("filters preferred poll languages before pagination", async () => {
    await searchPolls({ languages: ["ko"], appLocale: "en" });

    expect(pollSearchMock.mock.calls[0]?.[1].filter).toEqual([
      '(isLanguageNeutral = true OR languages IN ["ko", "en"])',
    ]);
  });

  test("searches over titles and options without forcing a recency sort", async () => {
    await searchPolls({ keyword: "Saturday" });

    expect(pollSearchMock).toHaveBeenCalledWith("Saturday", {
      offset: 0,
      limit: 20,
      filter: undefined,
      sort: undefined,
    });
  });
});

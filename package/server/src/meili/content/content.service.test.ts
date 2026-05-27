import { beforeEach, describe, expect, mock, test } from "bun:test";

const contentSearchMock = mock(async (_query: string, _params: any) => ({
  hits: [],
  estimatedTotalHits: 0,
  processingTimeMs: 1,
  query: _query,
}));

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

describe("searchContent work-domain behavior", () => {
  beforeEach(() => {
    contentSearchMock.mockClear();
    contentSearchMock.mockResolvedValue({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 1,
      query: "",
    });
  });

  test("filters tags through allTagIds and supports work-domain filters", async () => {
    await searchContent({
      tagIds: ["tag-1"],
      workUnitId: "work-1",
      workRoles: ["RELEASE"],
    });

    expect(contentSearchMock.mock.calls[0]?.[1].filter).toEqual([
      'allTagIds = "tag-1"',
      'workUnitId = "work-1"',
      'workRoles = "RELEASE"',
      'visibility = "PUBLIC"',
    ]);
  });

  test("groups release hits and exposes collapsed alternatives", async () => {
    contentSearchMock.mockResolvedValueOnce({
      hits: [
        {
          id: "release-secondary",
          searchGroupId: "work-1",
          displayPolicy: "SECONDARY",
          position: "b0",
        },
        {
          id: "release-primary",
          searchGroupId: "work-1",
          displayPolicy: "PRIMARY",
          position: "a0",
        },
        {
          id: "standalone",
          searchGroupId: "standalone",
          displayPolicy: null,
          position: null,
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
        { id: "release-primary", searchGroupId: "work-1" },
        { id: "release-secondary", searchGroupId: "work-1" },
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

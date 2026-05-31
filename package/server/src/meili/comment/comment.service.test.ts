import { describe, expect, mock, test } from "bun:test";

const commentSearchMock = mock(async (_query: string, _params: any) => ({
  hits: [],
  estimatedTotalHits: 0,
  processingTimeMs: 1,
  query: _query,
}));

mock.module("../search-client", () => ({
  searchClient: {
    commentIndex: {
      search: commentSearchMock,
    },
  },
}));

const { buildCommentSearchFilter, searchComments } = await import(
  "./comment.service"
);

describe("searchComments", () => {
  test("builds root and realm partition filters", async () => {
    commentSearchMock.mockClear();

    await searchComments({
      keyword: "answer",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentUnitId: "comment-1",
      sort: { field: "hotScore" },
      offset: 20,
      limit: 10,
    });

    expect(commentSearchMock).toHaveBeenCalledWith("answer", {
      offset: 20,
      limit: 10,
      filter: [
        'rootUnitId = "post-1"',
        'realmUnitId = "realm-1"',
        'parentCommentUnitId = "comment-1"',
      ],
      sort: ["hotScore:desc"],
    });
  });

  test("filter builder supports author, depth, lock, and state", () => {
    expect(
      buildCommentSearchFilter({
        authorUserId: "user-1",
        depth: 2,
        isLocked: false,
        state: "open",
      }),
    ).toEqual([
      'authorUserId = "user-1"',
      "depth = 2",
      "isLocked = false",
      'state = "open"',
    ]);
  });
});

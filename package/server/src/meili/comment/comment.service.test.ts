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

const { buildCommentSearchFilter, commentSliceSort, searchComments } =
  await import("./comment.service");

describe("searchComments", () => {
  test("builds root and realm partition filters", async () => {
    commentSearchMock.mockClear();

    await searchComments({
      keyword: "answer",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentId: "comment-1",
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
        'parentCommentId = "comment-1"',
      ],
      sort: ["hotScore:desc"],
    });
  });

  test("filter builder supports author, depth, lock, state, and moderation", () => {
    expect(
      buildCommentSearchFilter({
        authorUserId: "user-1",
        depth: 2,
        isLocked: false,
        state: "open",
        moderationStatus: "APPROVED",
      }),
    ).toEqual([
      'authorUserId = "user-1"',
      "depth = 2",
      "isLocked = false",
      'state = "open"',
      'moderationStatus = "APPROVED"',
    ]);
  });

  test("filter builder preserves null partition semantics", () => {
    expect(
      buildCommentSearchFilter({
        rootUnitId: "post-1",
        realmUnitId: null,
        parentCommentId: null,
      }),
    ).toEqual([
      'rootUnitId = "post-1"',
      "realmUnitId IS NULL",
      "parentCommentId IS NULL",
    ]);
  });

  test("maps comment slice sorts to serving document fields", () => {
    expect(commentSliceSort("best")).toBe("bestScore:desc");
    expect(commentSliceSort("top")).toBe("topScore:desc");
    expect(commentSliceSort("rising")).toBe("risingScore:desc");
    expect(commentSliceSort("controversial")).toBe("controversyScore:desc");
    expect(commentSliceSort("new")).toBe("createdAt:desc");
    expect(commentSliceSort("old")).toBe("createdAt:asc");
  });
});

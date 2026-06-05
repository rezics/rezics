import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import {
  buildCommentDocument,
  setSearchDb,
  syncCommentSegment,
  syncSingleComment,
} from "./sync";

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    then(resolve: (value: unknown[]) => unknown) {
      return Promise.resolve(resolve(rowSets.shift() ?? []));
    },
    leftJoin() {
      return createChain();
    },
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

const commentRow = {
  id: "comment-1",
  rootUnitId: "post-1",
  realmUnitId: "realm-1",
  parentCommentId: null,
  authorUserId: "user-1",
  content: markdownContentDoc("hello"),
  depth: 1,
  path: "1",
  replyCount: 0,
  directReplyCount: 0,
  lastReplyAt: null,
  isLocked: false,
  state: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  moderationStatus: "APPROVED",
  authorName: "Ada",
  authorSlug: "ada",
  authorAvatar: null,
};

describe("comment search sync", () => {
  test("buildCommentDocument projects root and realm partition fields", () => {
    const doc = buildCommentDocument({
      id: "comment-1",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentId: null,
      authorUserId: "user-1",
      content: markdownContentDoc("hello"),
      depth: 1,
      path: "1",
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      state: null,
      moderationStatus: "APPROVED",
      deletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      author: { name: "Ada", slug: "ada", avatar: null },
    });

    expect(doc).toMatchObject({
      id: "comment-1",
      contentText: "hello",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentId: null,
      authorName: "Ada",
    });
  });

  test("syncSingleComment reads comment and author through Drizzle", async () => {
    const deleteComments = mock(async () => ({}));
    const addOrUpdateComments = mock(async () => ({}));
    setSearchDb(createDb([[commentRow]]) as never);

    await syncSingleComment(
      { deleteComments, addOrUpdateComments } as any,
      "comment-1",
    );

    expect(addOrUpdateComments).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "comment-1",
        contentText: "hello",
        path: "1",
        authorName: "Ada",
        authorSlug: "ada",
      }),
    ]);
    expect(deleteComments).not.toHaveBeenCalled();
  });

  test("syncSingleComment deletes non-indexable comments", async () => {
    const deleteComments = mock(async () => ({}));
    const addOrUpdateComments = mock(async () => ({}));
    setSearchDb(
      createDb([[{ ...commentRow, moderationStatus: "REMOVED" }]]) as never,
    );

    await syncSingleComment(
      { deleteComments, addOrUpdateComments } as any,
      "comment-1",
    );

    expect(deleteComments).toHaveBeenCalledWith(["comment-1"]);
    expect(addOrUpdateComments).not.toHaveBeenCalled();
  });

  test("syncCommentSegment returns cursor from Drizzle rows", async () => {
    const addOrUpdateComments = mock(async () => ({}));
    setSearchDb(
      createDb([[commentRow, { ...commentRow, id: "comment-2" }]]) as never,
    );

    const result = await syncCommentSegment({ addOrUpdateComments } as any, {
      limit: 1,
    });

    expect(result).toEqual({ processed: 1, nextCursor: "comment-1" });
    expect(addOrUpdateComments).toHaveBeenCalledTimes(1);
  });
});

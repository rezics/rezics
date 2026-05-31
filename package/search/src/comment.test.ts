import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import {
  buildCommentDocument,
  setSearchPrismaClient,
  syncSingleComment,
} from "./sync";

describe("comment search sync", () => {
  test("buildCommentDocument projects root and realm partition fields", () => {
    const doc = buildCommentDocument({
      unitId: "comment-1",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentUnitId: null,
      authorUserId: "user-1",
      content: markdownContentDoc("hello"),
      depth: 1,
      path: "1",
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      state: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      unit: { user: { name: "Ada", slug: "ada", avatar: null } },
    });

    expect(doc).toMatchObject({
      id: "comment-1",
      contentText: "hello",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentUnitId: null,
      authorName: "Ada",
    });
  });

  test("syncSingleComment deletes non-indexable comments", async () => {
    const deleteComments = mock(async () => ({}));
    const addOrUpdateComments = mock(async () => ({}));
    setSearchPrismaClient({
      comment: {
        findUnique: mock(async () => ({
          unitId: "comment-1",
          unit: { status: "DRAFT", visibility: "PUBLIC" },
        })),
      },
    } as any);

    await syncSingleComment(
      { deleteComments, addOrUpdateComments } as any,
      "comment-1",
    );

    expect(deleteComments).toHaveBeenCalledWith(["comment-1"]);
    expect(addOrUpdateComments).not.toHaveBeenCalled();
  });
});

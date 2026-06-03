import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  CommentSearchDocumentSchema,
  CommentSearchOptionsSchema,
} from "./comment";

describe("CommentSearchDocumentSchema", () => {
  test("indexes comments by generic root unit and realm partition", () => {
    expect(
      Value.Check(CommentSearchDocumentSchema, {
        id: "comment-1",
        contentText: "answer text",
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentId: null,
        authorUserId: "user-1",
        depth: 1,
        path: "1",
        isLocked: false,
        replyCount: 0,
        directReplyCount: 0,
        lastReplyAt: null,
        state: null,
        moderationStatus: "APPROVED",
        createdAt: "2026-05-31T00:00:00.000Z",
        updatedAt: "2026-05-31T00:00:00.000Z",
        hotScore: 0,
        topScore: 0,
        qualityScore: 0,
        rankUpdatedAt: null,
        authorName: "Reader",
        authorSlug: "reader",
        authorAvatar: null,
      }),
    ).toBe(true);
  });

  test("supports realm-scoped root and parent filters", () => {
    expect(
      Value.Check(CommentSearchOptionsSchema, {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentId: "comment-1",
      }),
    ).toBe(true);
  });
});

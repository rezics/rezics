import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  commentDTOSchema,
  commentListContextSchema,
  commentListQuerySchema,
  commentListResponseSchema,
  commentModerationInputSchema,
  createCommentSchema,
  updateCommentSchema,
} from "./comment";

describe("comment contract", () => {
  test("accepts a direct comment under a root unit and realm partition", () => {
    expect(
      Value.Check(commentDTOSchema, {
        id: "comment-1",
        unitId: "comment-1",
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentId: null,
        authorUserId: "user-1",
        content: null,
        moderationStatus: "approved",
        depth: 1,
        pinKind: "ACCEPTED_ANSWER",
        pinPosition: "a0",
      }),
    ).toBe(true);
  });

  test("writes require rootUnitId and an explicit nullable realmUnitId", () => {
    expect(
      Value.Check(createCommentSchema, {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        content: { type: "doc", content: [] },
      }),
    ).toBe(true);

    // null targets the direct partition; omitting it entirely is invalid
    expect(
      Value.Check(createCommentSchema, {
        rootUnitId: "post-1",
        realmUnitId: null,
        content: { type: "doc", content: [] },
      }),
    ).toBe(true);
    expect(
      Value.Check(createCommentSchema, {
        rootUnitId: "post-1",
        content: { type: "doc", content: [] },
      }),
    ).toBe(false);

    expect(
      Value.Check(createCommentSchema, {
        rootPostUnitId: "post-1",
        content: { type: "doc", content: [] },
      }),
    ).toBe(false);
  });

  test("updates do not accept realm reassignment", () => {
    expect("realmUnitId" in updateCommentSchema.properties).toBe(false);

    expect(
      Value.Check(updateCommentSchema, {
        isLocked: true,
        state: "closed",
      }),
    ).toBe(true);
  });

  test("lists comments through the three-state context selector", () => {
    expect(
      Value.Check(commentListQuerySchema, {
        rootUnitId: "post-1",
        context: { kind: "realm", realmUnitId: "realm-1" },
        parentCommentId: "comment-1",
        mode: "children",
        sort: "best",
        cursor: {
          id: "comment-0",
          sortValue: 10,
        },
        limit: 20,
      }),
    ).toBe(true);

    // context is optional: omitted means the unconstrained `all` read
    expect(
      Value.Check(commentListQuerySchema, {
        rootUnitId: "post-1",
        mode: "discovery",
      }),
    ).toBe(true);

    expect(Value.Check(commentListContextSchema, { kind: "all" })).toBe(true);
    expect(Value.Check(commentListContextSchema, { kind: "direct" })).toBe(
      true,
    );
    expect(Value.Check(commentListContextSchema, { kind: "realm" })).toBe(
      false,
    );
    // the legacy flat realmUnitId filter is gone from the read contract
    expect("realmUnitId" in commentListQuerySchema.properties).toBe(false);
  });

  test("list response carries thread promotion signals", () => {
    expect(
      Value.Check(commentListResponseSchema, {
        mode: "discovery",
        comments: [],
        parentContexts: [],
        nextCursor: null,
        total: 0,
        viewerCanPromote: true,
        isQuestionThread: true,
      }),
    ).toBe(true);
  });

  test("comment moderation command accepts the closed action vocabulary", () => {
    expect(
      Value.Check(commentModerationInputSchema, {
        action: "remove",
        reasonCode: "comment.abuse",
        reasonText: "abuse",
        publicMessage: null,
        requestId: "request-1",
        idempotencyKey: "request-1:comment-1:remove",
      }),
    ).toBe(true);

    expect(
      Value.Check(commentModerationInputSchema, {
        action: "hide",
        reasonCode: "comment.abuse",
      }),
    ).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  commentDTOSchema,
  commentListQuerySchema,
  commentListResponseSchema,
  createCommentSchema,
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
        depth: 1,
        path: "1",
        pinKind: "ACCEPTED_ANSWER",
        pinPosition: "a0",
      }),
    ).toBe(true);
  });

  test("writes require rootUnitId and allow nullable realmUnitId", () => {
    expect(
      Value.Check(createCommentSchema, {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        content: { type: "doc", content: [] },
      }),
    ).toBe(true);

    expect(
      Value.Check(createCommentSchema, {
        rootPostUnitId: "post-1",
        content: { type: "doc", content: [] },
      }),
    ).toBe(false);
  });

  test("lists comments by stable root and realm partition", () => {
    expect(
      Value.Check(commentListQuerySchema, {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentId: "comment-1",
        mode: "threaded",
        limit: 20,
      }),
    ).toBe(true);
  });

  test("list response carries thread promotion signals", () => {
    expect(
      Value.Check(commentListResponseSchema, {
        comments: [],
        total: 0,
        viewerCanPromote: true,
        isQuestionThread: true,
      }),
    ).toBe(true);
  });
});

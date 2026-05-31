import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  commentDTOSchema,
  commentListQuerySchema,
  createCommentSchema,
} from "./comment";

describe("comment contract", () => {
  test("accepts a direct comment under a root unit and realm partition", () => {
    expect(
      Value.Check(commentDTOSchema, {
        unitId: "comment-1",
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentUnitId: null,
        authorUserId: "user-1",
        content: null,
        depth: 1,
        path: "1",
      }),
    ).toBe(true);
  });

  test("requires explicit rootUnitId and realmUnitId on writes", () => {
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
        parentCommentUnitId: "comment-1",
        limit: 20,
      }),
    ).toBe(true);
  });
});

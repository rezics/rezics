import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { PostSearchDocumentSchema, PostSearchOptionsSchema } from "./post";

describe("PostSearchDocumentSchema work-domain fields", () => {
  test("accepts UnitWork-derived membership fields", () => {
    expect(
      Value.Check(PostSearchDocumentSchema, {
        id: "post-1",
        contentText: "review",
        kind: "REVIEW",
        depth: 0,
        sortPath: null,
        isLocked: false,
        replyCount: 0,
        directReplyCount: 0,
        lastReplyAt: null,
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
        targetUnitId: "release-1",
        rootTargetUnitId: "release-1",
        rootTargetUnitType: "BOOK",
        realmIds: [],
        workUnitIds: ["work-1"],
        workRoles: ["REVIEW"],
        rootPostUnitId: null,
        parentPostUnitId: null,
        authorUserId: "user-1",
        scoreEntryId: null,
        authorName: "Reader",
        authorSlug: "reader",
        authorAvatar: null,
        targetTitles: ["Release"],
        targetType: "BOOK",
        targetCoverUrl: null,
        scoreValue: null,
        scoreFields: null,
      }),
    ).toBe(true);
  });

  test("accepts work-domain feed options while preserving target filters", () => {
    expect(
      Value.Check(PostSearchOptionsSchema, {
        workUnitId: "work-1",
        workRoles: ["POST", "REVIEW"],
      }),
    ).toBe(true);
    expect(
      Value.Check(PostSearchOptionsSchema, {
        targetUnitId: "release-1",
      }),
    ).toBe(true);
  });
});

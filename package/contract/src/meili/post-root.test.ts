import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { PostSearchDocumentSchema, PostSearchOptionsSchema } from "./post";

describe("PostSearchDocumentSchema root post fields", () => {
  test("accepts root-post search fields without reply fields", () => {
    expect(
      Value.Check(PostSearchDocumentSchema, {
        id: "post-1",
        contentText: "review",
        kind: "REVIEW",
        isLocked: false,
        replyCount: 0,
        directReplyCount: 0,
        lastReplyAt: null,
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
        hotScore: 0,
        topScore: 0,
        trendingScore: 0,
        qualityScore: 0,
        rankUpdatedAt: null,
        targetUnitId: "release-1",
        variantUnitId: "variant-1",
        realmIds: [],
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

  test("accepts target and realm feed options", () => {
    expect(
      Value.Check(PostSearchOptionsSchema, {
        targetUnitId: "release-1",
        variantUnitId: "variant-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(PostSearchOptionsSchema, {
        targetUnitId: "release-1",
        realmUnitId: "realm-1",
      }),
    ).toBe(true);
  });
});

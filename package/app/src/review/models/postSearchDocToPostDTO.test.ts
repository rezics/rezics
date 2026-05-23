import { describe, expect, test } from "bun:test";
import type { PostSearchDocument } from "@rezics/contract";
import { mapPostSearchDocToPostDTO } from "./postSearchDocToPostDTO";

function makeDoc(
  overrides: Partial<PostSearchDocument> = {},
): PostSearchDocument {
  return {
    id: "review-1",
    contentText: "A careful review.",
    kind: "REVIEW",
    depth: 0,
    sortPath: null,
    isLocked: false,
    replyCount: 0,
    directReplyCount: 0,
    lastReplyAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    targetUnitId: "book-1",
    rootTargetUnitId: "book-1",
    rootTargetUnitType: "BOOK",
    realmIds: [],
    rootPostUnitId: null,
    parentPostUnitId: null,
    authorUserId: "user-1",
    scoreEntryId: null,
    authorName: "Reader",
    authorSlug: "reader",
    authorAvatar: null,
    targetTitles: ["The Book"],
    targetType: "BOOK",
    targetCoverUrl: null,
    scoreValue: null,
    scoreFields: null,
    extra: { title: "Review title" },
    ...overrides,
  };
}

describe("mapPostSearchDocToPostDTO", () => {
  test("keeps review title and adds target book metadata", () => {
    const dto = mapPostSearchDocToPostDTO(makeDoc());

    expect(dto.extra).toEqual({
      title: "Review title",
      book: { id: "book-1", title: "The Book" },
    });
  });

  test("leaves extra unchanged when target title is unavailable", () => {
    const dto = mapPostSearchDocToPostDTO(
      makeDoc({ targetTitles: null, extra: { title: "Only title" } }),
    );

    expect(dto.extra).toEqual({ title: "Only title" });
  });
});

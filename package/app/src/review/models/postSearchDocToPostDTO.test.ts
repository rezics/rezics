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
    isLocked: false,
    replyCount: 0,
    directReplyCount: 0,
    lastReplyAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hotScore: 0,
    topScore: 0,
    trendingScore: 0,
    qualityScore: 0,
    rankUpdatedAt: null,
    targetUnitId: "book-1",
    realmIds: [],
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
    titleText: "Review title",
    extra: null,
    ...overrides,
  };
}

describe("mapPostSearchDocToPostDTO", () => {
  test("keeps review title and adds target book metadata", () => {
    const dto = mapPostSearchDocToPostDTO(makeDoc());

    expect(dto.title).toBe("Review title");
    expect(dto.extra).toEqual({
      book: { id: "book-1", title: "The Book" },
    });
  });

  test("leaves extra unchanged when target title is unavailable", () => {
    const dto = mapPostSearchDocToPostDTO(
      makeDoc({ targetTitles: null, extra: { rating: 4 } }),
    );

    expect(dto.extra).toEqual({ rating: 4 });
  });

  test("uses resolved title/content without falling back to aggregate text", () => {
    const dto = mapPostSearchDocToPostDTO(
      makeDoc({
        resolvedLanguage: "ja",
        title: null,
        content: null,
        titleText: "English fallback title",
        contentText: "English fallback body",
      }),
    );

    expect(dto.title).toBeUndefined();
    expect(dto.content.main.source).toBe("");
  });
});

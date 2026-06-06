import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { feedResponseSchema } from "./feed";

describe("feed row contract", () => {
  test("accepts content rows with sort-aware cursor", () => {
    expect(
      Value.Check(feedResponseSchema, {
        scope: "home",
        sort: "best",
        rows: [
          {
            type: "content",
            rowId: "post:post-1",
            href: "/post/post-1",
            post: {
              unitId: "post-1",
              authorUserId: "user-1",
              kind: "REVIEW",
            },
            targetUnit: {
              unitId: "book-1",
              kind: "book",
              title: "Target Work",
            },
          },
        ],
        nextCursor: {
          rowId: "post:post-1",
          sortValue: 42,
          createdAt: "2026-06-05T00:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  test("accepts carousel rows", () => {
    expect(
      Value.Check(feedResponseSchema, {
        scope: "library",
        sort: "new",
        rows: [
          {
            type: "carousel",
            rowId: "carousel:works:book",
            carouselKind: "works",
            title: { key: "feed.carousel.newBooks" },
            works: [{ unitId: "book-1", kind: "book", title: "Book" }],
          },
        ],
        nextCursor: null,
      }),
    ).toBe(true);
  });
});

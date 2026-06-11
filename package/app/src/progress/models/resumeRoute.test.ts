import { describe, expect, test } from "bun:test";
import type { ContinueReadingItem, ResumeRoute } from "@rezics/contract";
import { continueReadingProgress, resumeRouteToHref } from "./resumeRoute";

function makeItem(
  overrides: Partial<ContinueReadingItem> = {},
): ContinueReadingItem {
  return {
    bookUnitId: "book-1",
    bookTitle: "Book",
    lastReadNodeId: null,
    lastReadNodeTitle: null,
    chaptersCompleted: 0,
    chaptersTotal: 0,
    resumeRoute: { kind: "book", bookId: "book-1" },
    ...overrides,
  };
}

describe("resumeRouteToHref", () => {
  test("node route preserves multi-link TOC disambiguation", () => {
    const route: ResumeRoute = {
      kind: "node",
      bookId: "b1",
      nodeId: "n1",
    };
    expect(resumeRouteToHref(route)).toBe("/book/b1/node/n1");
  });

  test("chapter route targets the chapter reader", () => {
    const route: ResumeRoute = {
      kind: "chapter",
      bookId: "b1",
      chapterId: "c1",
    };
    expect(resumeRouteToHref(route)).toBe("/book/b1/read/c1");
  });

  test("book route targets the book detail", () => {
    const route: ResumeRoute = { kind: "book", bookId: "b1" };
    expect(resumeRouteToHref(route)).toBe("/book/b1");
  });
});

describe("continueReadingProgress", () => {
  test("ratio of completed to total", () => {
    expect(
      continueReadingProgress(
        makeItem({ chaptersCompleted: 3, chaptersTotal: 10 }),
      ),
    ).toBeCloseTo(0.3);
  });

  test("zero when the book has no countable nodes", () => {
    expect(
      continueReadingProgress(
        makeItem({ chaptersCompleted: 0, chaptersTotal: 0 }),
      ),
    ).toBe(0);
  });

  test("clamps to 1 when completed exceeds total", () => {
    expect(
      continueReadingProgress(
        makeItem({ chaptersCompleted: 12, chaptersTotal: 10 }),
      ),
    ).toBe(1);
  });
});

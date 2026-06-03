import { describe, expect, test } from "bun:test";
import type { BookDTO, ContinueReadingItem } from "@rezics/contract";
import { bookToBookshelfItem, progressByBook } from "./libraryShelf";

function continueItem(
  overrides: Partial<ContinueReadingItem> & { bookUnitId: string },
): ContinueReadingItem {
  return {
    bookTitle: "Book",
    lastReadNodeId: null,
    lastReadNodeTitle: null,
    chaptersCompleted: 0,
    chaptersTotal: 0,
    resumeRoute: { kind: "book", bookId: overrides.bookUnitId },
    ...overrides,
  };
}

function book(overrides: {
  unitId: string;
  title?: string | null;
  translations?: { language: string; title: string }[];
  coverUrl?: string | null;
  isLicensed?: boolean;
}): BookDTO {
  return {
    translations: [{ language: "en", title: "Untitled" }],
    title: "Untitled",
    resolvedLanguage: "en",
    coverUrl: null,
    ...overrides,
  } as unknown as BookDTO;
}

describe("progressByBook", () => {
  test("indexes counters and last-read title by book unit id", () => {
    const map = progressByBook([
      continueItem({
        bookUnitId: "b1",
        chaptersCompleted: 3,
        chaptersTotal: 12,
        lastReadNodeTitle: "Chapter 3",
      }),
    ]);
    expect(map.get("b1")).toEqual({
      chaptersCompleted: 3,
      chaptersTotal: 12,
      lastReadChapterTitle: "Chapter 3",
    });
  });

  test("null last-read title becomes undefined", () => {
    const map = progressByBook([continueItem({ bookUnitId: "b2" })]);
    expect(map.get("b2")?.lastReadChapterTitle).toBeUndefined();
  });
});

describe("bookToBookshelfItem", () => {
  test("maps core book fields to a bookshelf item", () => {
    const item = bookToBookshelfItem(
      book({
        unitId: "b1",
        title: "Dune",
        coverUrl: "https://x/d.jpg",
        isLicensed: true,
      }),
    );
    expect(item).toMatchObject({
      unitId: "b1",
      kind: "book",
      title: "Dune",
      coverUrl: "https://x/d.jpg",
      isLicensed: true,
      href: "/book/b1",
    });
    expect(item.chaptersTotal).toBeUndefined();
  });

  test("attaches the counter when the book has countable chapters", () => {
    const item = bookToBookshelfItem(book({ unitId: "b1" }), {
      chaptersCompleted: 3,
      chaptersTotal: 12,
      lastReadChapterTitle: "Chapter 3",
    });
    expect(item.chaptersCompleted).toBe(3);
    expect(item.chaptersTotal).toBe(12);
    expect(item.lastReadChapterTitle).toBe("Chapter 3");
  });

  test("omits the counter when the book has no countable chapters", () => {
    const item = bookToBookshelfItem(book({ unitId: "b1" }), {
      chaptersCompleted: 0,
      chaptersTotal: 0,
    });
    expect(item.chaptersTotal).toBeUndefined();
  });

  test("falls back to unitId when no resolved title exists", () => {
    const item = bookToBookshelfItem(
      book({ unitId: "b9", title: null, translations: [] }),
    );
    expect(item.title).toBe("b9");
  });
});

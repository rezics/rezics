import { describe, expect, test } from "bun:test";
import type {
  BookDTO,
  ContinueReadingItem,
  ProgressLibraryRow,
} from "@rezics/contract";
import {
  bookToBookshelfItem,
  progressByBook,
  progressLibraryRowToBookshelfItem,
} from "./libraryShelf";

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
  translations?: { language: string; title: string }[];
  coverUrl?: string | null;
  isLicensed?: boolean;
}): BookDTO {
  return {
    translations: [{ language: "en", title: "Untitled" }],
    coverUrl: null,
    ...overrides,
  } as unknown as BookDTO;
}

function progressRow(unitId: string): ProgressLibraryRow["progress"] {
  return {
    userId: "user-1",
    unitId,
    progress: 0.4,
    status: "ACTIVE",
    isDeleted: false,
    completedCount: 0,
    totalTimeMs: 0,
    lastReadNodeId: null,
    lastReadAnchor: null,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    extra: null,
  };
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
        translations: [{ language: "en", title: "Dune" }],
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

  test("falls back to unitId when no translation title exists", () => {
    const item = bookToBookshelfItem(book({ unitId: "b9", translations: [] }));
    expect(item.title).toBe("b9");
  });
});

describe("progressLibraryRowToBookshelfItem", () => {
  test("maps progress-owned rows without requiring shelf membership", () => {
    const row = {
      progress: progressRow("b1"),
      progressUnit: {
        unitId: "b1",
        title: "Dune",
        coverUrl: "https://x/d.jpg",
        unitType: "BOOK",
        catalogEntryKind: "MAIN",
        targetUnitId: null,
      },
      mainUnitContext: null,
      resumeRoute: { kind: "book", bookId: "b1" },
      shelves: [],
    } satisfies ProgressLibraryRow;

    expect(progressLibraryRowToBookshelfItem(row)).toMatchObject({
      unitId: "b1",
      kind: "book",
      title: "Dune",
      coverUrl: "https://x/d.jpg",
      href: "/book/b1",
    });
  });

  test("skips non-library unit types", () => {
    const row = {
      progress: progressRow("post-1"),
      progressUnit: {
        unitId: "post-1",
        title: "Post",
        unitType: "POST",
        catalogEntryKind: null,
        targetUnitId: null,
      },
      mainUnitContext: null,
      shelves: [],
    } satisfies ProgressLibraryRow;

    expect(progressLibraryRowToBookshelfItem(row)).toBeNull();
  });
});

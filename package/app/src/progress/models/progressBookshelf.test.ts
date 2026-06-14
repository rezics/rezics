import { describe, expect, test } from "bun:test";
import type { ProgressLibraryRow } from "@rezics/contract";
import { progressLibraryRowToBookshelfItem } from "./progressBookshelf";

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
  };
}

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

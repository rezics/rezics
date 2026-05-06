import { describe, expect, mock, test } from "bun:test";
import {
  BookIndexPathError,
  getBookIndexNode,
  migrateLegacyBookIndexIds,
  normalizeLegacyBookIndex,
  parseBookIndexPath,
  updateBookIndexNode,
} from "./book-index";

describe("BookIndex helpers", () => {
  test("normalizes empty and legacy object indexes to []", async () => {
    await expect(
      normalizeLegacyBookIndex({}, { unit: { findMany: mock() } } as any),
    ).resolves.toEqual([]);
  });

  test("parses dot-separated paths", () => {
    expect(parseBookIndexPath("2.4.0")).toEqual([2, 4, 0]);
  });

  test("rejects invalid paths", () => {
    expect(() => parseBookIndexPath("1.-1")).toThrow(BookIndexPathError);
  });

  test("looks up nested nodes by path", () => {
    const index = [
      { title: "A" },
      { title: "B", children: [{ title: "B.1" }] },
    ];

    expect(getBookIndexNode(index, [1, 0])?.title).toBe("B.1");
    expect(getBookIndexNode(index, [3])).toBeNull();
  });

  test("immutably updates a node at path", () => {
    const index = [
      { title: "A" },
      { title: "B", children: [{ title: "B.1" }] },
    ];

    const next = updateBookIndexNode(index, [1, 0], (node) => ({
      ...node,
      chapterUnitId: "chapter-1",
    }));

    expect(next[1]?.children?.[0]?.chapterUnitId).toBe("chapter-1");
    expect(index[1]?.children?.[0]?.chapterUnitId).toBeUndefined();
  });

  test("normalization ignores legacy id fields during normal reads", async () => {
    const tx = {
      unit: {
        findMany: mock(async () => [{ id: "chapter-1" }]),
      },
    };

    const next = await normalizeLegacyBookIndex(
      [
        { id: "chapter-1", title: "Materialized" },
        { id: "imported-local-1", title: "Imported" },
      ],
      tx as any,
    );

    expect(next).toEqual([
      { title: "Materialized" },
      { title: "Imported" },
    ]);
  });

  test("migration maps legacy ids only when they are materialized Unit ids", async () => {
    const tx = {
      unit: {
        findMany: mock(async () => [{ id: "chapter-1" }]),
      },
    };

    const next = await migrateLegacyBookIndexIds(
      [
        { id: "chapter-1", title: "Materialized" },
        { id: "imported-local-1", title: "Imported" },
      ],
      tx as any,
    );

    expect(next).toEqual([
      { title: "Materialized", chapterUnitId: "chapter-1" },
      { title: "Imported" },
    ]);
  });

  test("allows repeated chapterUnitId values", async () => {
    const tx = {
      unit: {
        findMany: mock(async () => [{ id: "chapter-1" }]),
      },
    };

    const next = await normalizeLegacyBookIndex(
      [
        { title: "A", chapterUnitId: "chapter-1" },
        { title: "B", chapterUnitId: "chapter-1" },
      ],
      tx as any,
    );

    expect(next).toEqual([
      { title: "A", chapterUnitId: "chapter-1" },
      { title: "B", chapterUnitId: "chapter-1" },
    ]);
  });
});

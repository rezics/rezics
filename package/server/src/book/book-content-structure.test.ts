import { describe, expect, test } from "bun:test";
import {
  BookContentStructurePathError,
  getBookContentStructureNode,
  normalizeBookContentStructureValue,
  parseBookContentStructurePath,
  updateBookContentStructureNode,
} from "./book-content-structure";

describe("BookContentStructure helpers", () => {
  test("normalizes empty and object nodes to []", () => {
    expect(normalizeBookContentStructureValue({})).toEqual([]);
  });

  test("parses dot-separated paths", () => {
    expect(parseBookContentStructurePath("2.4.0")).toEqual([2, 4, 0]);
  });

  test("rejects invalid paths", () => {
    expect(() => parseBookContentStructurePath("1.-1")).toThrow(
      BookContentStructurePathError,
    );
  });

  test("looks up nested nodes by path", () => {
    const nodes = [
      { title: "A" },
      { title: "B", children: [{ title: "B.1" }] },
    ];

    expect(getBookContentStructureNode(nodes, [1, 0])?.title).toBe("B.1");
    expect(getBookContentStructureNode(nodes, [3])).toBeNull();
  });

  test("immutably updates a node at path", () => {
    const nodes = [
      { title: "A" },
      { title: "B", children: [{ title: "B.1" }] },
    ];

    const next = updateBookContentStructureNode(nodes, [1, 0], (node) => ({
      ...node,
      chapterUnitId: "chapter-1",
    }));

    expect(next[1]?.children?.[0]?.chapterUnitId).toBe("chapter-1");
    expect(nodes[1]?.children?.[0]?.chapterUnitId).toBeUndefined();
  });

  test("allows repeated chapterUnitId values", async () => {
    const next = normalizeBookContentStructureValue([
      { title: "A", chapterUnitId: "chapter-1" },
      { title: "B", chapterUnitId: "chapter-1" },
    ]);

    expect(next).toEqual([
      { title: "A", chapterUnitId: "chapter-1" },
      { title: "B", chapterUnitId: "chapter-1" },
    ]);
  });
});

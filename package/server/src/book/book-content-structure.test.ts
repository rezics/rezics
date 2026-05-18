import { describe, expect, test } from "bun:test";
import {
  type BookContentStructureNodeRow,
  BookContentStructurePathError,
  buildTree,
  parseBookContentStructurePath,
  pathToNodeId,
  resolvePath,
} from "./book-content-structure";

function row(
  partial: Partial<BookContentStructureNodeRow> &
    Pick<BookContentStructureNodeRow, "id" | "parentId" | "sortKey" | "title">,
): BookContentStructureNodeRow {
  return {
    bookUnitId: "book-1",
    chapterUnitId: null,
    noContent: false,
    rating: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  };
}

describe("BookContentStructure path parsing", () => {
  test("parses dot-separated paths", () => {
    expect(parseBookContentStructurePath("2.4.0")).toEqual([2, 4, 0]);
  });

  test("rejects invalid paths", () => {
    expect(() => parseBookContentStructurePath("1.-1")).toThrow(
      BookContentStructurePathError,
    );
  });
});

describe("buildTree", () => {
  test("returns empty array for empty rows", () => {
    expect(buildTree([])).toEqual([]);
  });

  test("preserves sibling order via sortKey", () => {
    const rows = [
      row({ id: "n-b", parentId: null, sortKey: "n", title: "B" }),
      row({ id: "n-c", parentId: null, sortKey: "u", title: "C" }),
      row({ id: "n-a", parentId: null, sortKey: "g", title: "A" }),
    ];

    const tree = buildTree(rows);
    expect(tree.map((n) => n.title)).toEqual(["A", "B", "C"]);
  });

  test("nests children by parentId and orders them by sortKey", () => {
    const rows = [
      row({ id: "root", parentId: null, sortKey: "g", title: "Root" }),
      row({ id: "child-2", parentId: "root", sortKey: "n", title: "Two" }),
      row({ id: "child-1", parentId: "root", sortKey: "g", title: "One" }),
    ];

    const tree = buildTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.title).toBe("Root");
    expect(tree[0]!.children?.map((c) => c.title)).toEqual(["One", "Two"]);
  });

  test("missing children produce undefined (not empty array) on leaves", () => {
    const rows = [
      row({ id: "leaf", parentId: null, sortKey: "g", title: "Leaf" }),
    ];
    const tree = buildTree(rows);
    expect(tree[0]!.children).toBeUndefined();
  });

  test("populates id and updatedAt on every returned node", () => {
    const ts = new Date("2026-05-18T12:00:00.000Z");
    const rows = [
      row({
        id: "n-1",
        parentId: null,
        sortKey: "g",
        title: "Chapter",
        updatedAt: ts,
      }),
    ];

    const tree = buildTree(rows);
    expect(tree[0]!.id).toBe("n-1");
    expect(tree[0]!.updatedAt).toBe(ts.toISOString());
  });

  test("omits rating when row's rating is null and includes it when non-null", () => {
    const rows = [
      row({ id: "n-1", parentId: null, sortKey: "g", title: "A" }),
      row({
        id: "n-2",
        parentId: null,
        sortKey: "n",
        title: "B",
        rating: "R_18",
      }),
    ];
    const tree = buildTree(rows);
    expect(tree[0]!.rating).toBeUndefined();
    expect(tree[1]!.rating).toBe("R_18");
  });
});

describe("resolvePath / pathToNodeId", () => {
  const rows = [
    row({ id: "root-a", parentId: null, sortKey: "g", title: "A" }),
    row({ id: "root-b", parentId: null, sortKey: "n", title: "B" }),
    row({ id: "a-1", parentId: "root-a", sortKey: "g", title: "A.1" }),
    row({ id: "a-2", parentId: "root-a", sortKey: "n", title: "A.2" }),
  ];

  test("resolves a top-level node", () => {
    expect(resolvePath(rows, [0])?.id).toBe("root-a");
    expect(resolvePath(rows, [1])?.id).toBe("root-b");
  });

  test("walks sortKey-ordered children at each level", () => {
    expect(resolvePath(rows, [0, 0])?.id).toBe("a-1");
    expect(resolvePath(rows, [0, 1])?.id).toBe("a-2");
  });

  test("returns null for stale paths instead of throwing", () => {
    expect(resolvePath(rows, [5])).toBeNull();
    expect(resolvePath(rows, [0, 9])).toBeNull();
  });

  test("returns null for empty path", () => {
    expect(resolvePath(rows, [])).toBeNull();
  });

  test("pathToNodeId returns the id (or null) for the resolved path", () => {
    expect(pathToNodeId(rows, [0, 0])).toBe("a-1");
    expect(pathToNodeId(rows, [9])).toBeNull();
  });
});

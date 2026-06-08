import { describe, expect, test } from "bun:test";
import { ensureTreeChildren, stripEmptyTreeChildren } from "./treeOperations";

describe("treeOperations", () => {
  test("ensures every node has children for tree drop targets", () => {
    const tree = ensureTreeChildren([
      { id: "root", children: [{ id: "child" }] },
      { id: "leaf" },
    ]);

    expect(tree).toEqual([
      { id: "root", children: [{ id: "child", children: [] }] },
      { id: "leaf", children: [] },
    ]);
  });

  test("strips empty UI-only children before persistence", () => {
    const tree = stripEmptyTreeChildren([
      { id: "root", children: [{ id: "child", children: [] }] },
      { id: "leaf", children: [] },
    ]);

    expect(tree).toEqual([
      { id: "root", children: [{ id: "child" }] },
      { id: "leaf" },
    ]);
  });
});

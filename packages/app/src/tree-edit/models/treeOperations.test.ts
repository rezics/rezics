import { describe, expect, test } from "bun:test";
import {
  ensureTreeChildren,
  type NestedTreeNode,
  stripEmptyTreeChildren,
} from "./treeOperations";

describe("treeOperations", () => {
  test("ensures every node has children for tree drop targets", () => {
    const nodes: NestedTreeNode[] = [
      { id: "root", children: [{ id: "child" }] },
      { id: "leaf" },
    ];
    const tree = ensureTreeChildren(nodes);

    expect(tree).toEqual([
      { id: "root", children: [{ id: "child", children: [] }] },
      { id: "leaf", children: [] },
    ]);
  });

  test("strips empty UI-only children before persistence", () => {
    const nodes: NestedTreeNode[] = [
      { id: "root", children: [{ id: "child", children: [] }] },
      { id: "leaf", children: [] },
    ];
    const tree = stripEmptyTreeChildren(nodes);

    expect(tree).toEqual([
      { id: "root", children: [{ id: "child" }] },
      { id: "leaf" },
    ]);
  });
});

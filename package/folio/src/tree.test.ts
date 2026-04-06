import { describe, expect, it } from "bun:test";
import { flattenTree } from "./tree";
import type { FolioNode } from "./types";

const mockFetch = () => Promise.resolve({ contentType: "txt", raw: "" });

function leaf(id: string): FolioNode {
  return { id, title: id, fetch: mockFetch };
}

function branch(id: string, children: FolioNode[]): FolioNode {
  return { id, title: id, children };
}

describe("flattenTree", () => {
  it("flattens a nested tree depth-first", () => {
    const tree: FolioNode[] = [
      branch("part1", [leaf("ch1"), leaf("ch2"), leaf("ch3")]),
      branch("part2", [branch("section-a", [leaf("ch4")]), leaf("ch5")]),
    ];

    const flat = flattenTree(tree);
    expect(flat.map((f) => f.node.id)).toEqual([
      "ch1",
      "ch2",
      "ch3",
      "ch4",
      "ch5",
    ]);
    expect(flat.map((f) => f.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("records correct depth for each leaf", () => {
    const tree: FolioNode[] = [
      branch("part1", [leaf("ch1")]),
      branch("part2", [branch("section", [leaf("ch2")])]),
    ];

    const flat = flattenTree(tree);
    expect(flat[0].depth).toBe(1); // part1 > ch1
    expect(flat[1].depth).toBe(2); // part2 > section > ch2
  });

  it("records correct path for each leaf", () => {
    const tree: FolioNode[] = [
      branch("part1", [leaf("ch1"), leaf("ch2")]),
      branch("part2", [leaf("ch3")]),
    ];

    const flat = flattenTree(tree);
    expect(flat[0].path).toEqual([0, 0]); // part1[0] > ch1[0]
    expect(flat[1].path).toEqual([0, 1]); // part1[0] > ch2[1]
    expect(flat[2].path).toEqual([1, 0]); // part2[1] > ch3[0]
  });

  it("handles a flat tree (no branches)", () => {
    const tree: FolioNode[] = [leaf("ch1"), leaf("ch2"), leaf("ch3")];
    const flat = flattenTree(tree);

    expect(flat).toHaveLength(3);
    expect(flat.map((f) => f.depth)).toEqual([0, 0, 0]);
  });

  it("returns empty array for branch-only tree", () => {
    const tree: FolioNode[] = [
      branch("part1", [branch("section", [])]),
      branch("part2", []),
    ];

    expect(flattenTree(tree)).toEqual([]);
  });

  it("handles a single leaf", () => {
    const flat = flattenTree([leaf("only")]);
    expect(flat).toHaveLength(1);
    expect(flat[0].index).toBe(0);
    expect(flat[0].path).toEqual([0]);
  });

  it("handles an empty tree", () => {
    expect(flattenTree([])).toEqual([]);
  });
});

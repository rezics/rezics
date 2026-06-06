import { describe, expect, test } from "bun:test";
import { findNodeById, resolveNodeView } from "./resolveNodeView";

const nodes = [
  {
    id: "n-1",
    title: "Chapter 1",
    contentUnitId: "ch-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "n-2",
    title: "Section",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [
      {
        id: "n-2a",
        title: "Sub",
        contentUnitId: "ch-2a",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
];

describe("findNodeById", () => {
  test("finds top-level node", () => {
    const hit = findNodeById(nodes, "n-1");
    expect(hit?.path).toEqual([0]);
    expect(hit?.node.title).toBe("Chapter 1");
  });
  test("finds nested node and reports the path", () => {
    const hit = findNodeById(nodes, "n-2a");
    expect(hit?.path).toEqual([1, 0]);
  });
  test("returns null for missing id", () => {
    expect(findNodeById(nodes, "missing")).toBeNull();
  });
});

describe("resolveNodeView", () => {
  test("loading state", () => {
    expect(
      resolveNodeView({ nodes: undefined, isLoading: true, nodeId: "n-1" })
        .kind,
    ).toBe("loading");
  });
  test("not-found state", () => {
    expect(
      resolveNodeView({ nodes, isLoading: false, nodeId: "missing" }).kind,
    ).toBe("not-found");
  });
  test("reading state when a contentUnit is linked", () => {
    const state = resolveNodeView({ nodes, isLoading: false, nodeId: "n-1" });
    expect(state.kind).toBe("reading");
    if (state.kind === "reading") expect(state.contentUnitId).toBe("ch-1");
  });
  test("empty state when no contentUnit, and carries the resolved path", () => {
    const state = resolveNodeView({ nodes, isLoading: false, nodeId: "n-2" });
    expect(state.kind).toBe("empty");
    if (state.kind === "empty") expect(state.path).toEqual([1]);
  });
  test("reading state resolves a nested node's contentUnit and path", () => {
    const state = resolveNodeView({ nodes, isLoading: false, nodeId: "n-2a" });
    expect(state.kind).toBe("reading");
    if (state.kind === "reading") {
      expect(state.contentUnitId).toBe("ch-2a");
      expect(state.path).toEqual([1, 0]);
    }
  });
  test("deleted state overrides reading", () => {
    const state = resolveNodeView({
      nodes,
      isLoading: false,
      nodeId: "n-1",
      chapterUnitDeleted: true,
    });
    expect(state.kind).toBe("deleted");
  });
});

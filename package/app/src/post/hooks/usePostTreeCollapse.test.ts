import { describe, expect, it } from "bun:test";
import { markdownContentDoc, type CommentDTO } from "@rezics/contract";
import {
  filterByPathPrefix,
  getRevealExpandedIds,
  seedCollapsedIds,
} from "./usePostTreeCollapse";

function makePost(
  overrides: Partial<CommentDTO> & { unitId: string },
): CommentDTO {
  return {
    authorUserId: "u1",
    targetUnitId: "target",
    content: markdownContentDoc(""),
    kind: "REPLY" as any,
    depth: 0,
    path: "",
    replyCount: 0,
    directReplyCount: 0,
    ...overrides,
  } as CommentDTO;
}

describe("usePostTreeCollapse helpers", () => {
  it("seedCollapsedIds collapses posts after three visible generations by default", () => {
    const posts = [
      makePost({ unitId: "a", depth: 0, path: "01" }),
      makePost({ unitId: "b", depth: 1, path: "01.01" }),
      makePost({ unitId: "c", depth: 2, path: "01.01.01" }),
      makePost({ unitId: "d", depth: 3, path: "01.01.01.01" }),
    ];
    const ids = seedCollapsedIds(posts);
    expect(ids.has("a")).toBe(false);
    expect(ids.has("b")).toBe(false);
    expect(ids.has("c")).toBe(false);
    expect(ids.has("d")).toBe(true);
  });

  it("seedCollapsedIds respects custom visible generations", () => {
    const posts = [
      makePost({ unitId: "a", depth: 0 }),
      makePost({ unitId: "b", depth: 1 }),
      makePost({ unitId: "c", depth: 2 }),
    ];
    const ids = seedCollapsedIds(posts, 1);
    expect(ids.has("a")).toBe(false);
    expect(ids.has("b")).toBe(true);
    expect(ids.has("c")).toBe(true);
  });

  it("seedCollapsedIds applies visible generations relative to baseDepth", () => {
    const posts = [
      makePost({ unitId: "a", depth: 5 }),
      makePost({ unitId: "b", depth: 6 }),
      makePost({ unitId: "c", depth: 7 }),
    ];
    const ids = seedCollapsedIds(posts, {
      baseDepth: 4,
      defaultVisibleGenerations: 3,
    });

    expect(ids.has("a")).toBe(false);
    expect(ids.has("b")).toBe(false);
    expect(ids.has("c")).toBe(true);
  });

  it("getRevealExpandedIds returns the target node and visible ancestor path", () => {
    const posts = [
      makePost({ unitId: "a", path: "01" }),
      makePost({ unitId: "b", path: "01.01" }),
      makePost({ unitId: "c", path: "01.01.01" }),
      makePost({ unitId: "d", path: "02" }),
    ];

    expect(Array.from(getRevealExpandedIds(posts, "c"))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("seedCollapsedIds keeps the reveal path expanded", () => {
    const posts = [
      makePost({ unitId: "a", depth: 1, path: "01" }),
      makePost({ unitId: "b", depth: 2, path: "01.01" }),
      makePost({ unitId: "c", depth: 3, path: "01.01.01" }),
      makePost({ unitId: "d", depth: 4, path: "01.01.01.01" }),
    ];
    const ids = seedCollapsedIds(posts, { revealPostUnitId: "d" });

    expect(ids.has("c")).toBe(false);
    expect(ids.has("d")).toBe(false);
  });

  it("filterByPathPrefix hides descendants of collapsed posts by path", () => {
    const posts = [
      makePost({ unitId: "a", path: "01" }),
      makePost({ unitId: "b", path: "01.01" }),
      makePost({ unitId: "c", path: "01.01.01" }),
      makePost({ unitId: "d", path: "02" }),
    ];
    const collapsed = new Set(["b"]);
    const visible = filterByPathPrefix(posts, collapsed);
    expect(visible.map((p) => p.unitId)).toEqual(["a", "b", "d"]);
  });

  it("filterByPathPrefix keeps collapsed post itself visible", () => {
    const posts = [
      makePost({ unitId: "a", path: "01" }),
      makePost({ unitId: "b", path: "01.01" }),
    ];
    const collapsed = new Set(["a"]);
    const visible = filterByPathPrefix(posts, collapsed);
    expect(visible.map((p) => p.unitId)).toEqual(["a"]);
  });

  it("filterByPathPrefix returns posts unchanged when nothing collapsed", () => {
    const posts = [
      makePost({ unitId: "a", path: "01" }),
      makePost({ unitId: "b", path: "01.01" }),
    ];
    const visible = filterByPathPrefix(posts, new Set());
    expect(visible).toBe(posts);
  });

  it("toggle flow: expanded root shows descendants; after re-collapse they hide again", () => {
    const posts = [
      makePost({ unitId: "a", path: "01" }),
      makePost({ unitId: "b", path: "01.01" }),
      makePost({ unitId: "c", path: "01.01.01" }),
    ];
    let collapsed = new Set(["a"]);
    expect(filterByPathPrefix(posts, collapsed).map((p) => p.unitId)).toEqual([
      "a",
    ]);

    collapsed = new Set();
    expect(filterByPathPrefix(posts, collapsed).map((p) => p.unitId)).toEqual([
      "a",
      "b",
      "c",
    ]);

    collapsed = new Set(["a"]);
    expect(filterByPathPrefix(posts, collapsed).map((p) => p.unitId)).toEqual([
      "a",
    ]);
  });

  it("keeps nested collapsed state while an ancestor subtree is hidden", () => {
    const posts = [
      makePost({ unitId: "a", path: "01" }),
      makePost({ unitId: "b", path: "01.01" }),
      makePost({ unitId: "c", path: "01.01.01" }),
      makePost({ unitId: "d", path: "01.01.01.01" }),
    ];
    const collapsed = new Set(["a", "c"]);

    expect(filterByPathPrefix(posts, collapsed).map((p) => p.unitId)).toEqual([
      "a",
    ]);

    collapsed.delete("a");

    expect(filterByPathPrefix(posts, collapsed).map((p) => p.unitId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

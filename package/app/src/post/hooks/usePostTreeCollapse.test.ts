import { describe, expect, it } from "bun:test";
import { markdownContentDoc, type PostDTO } from "@rezics/contract";
import {
  filterBySortPathPrefix,
  getRevealExpandedIds,
  seedCollapsedIds,
} from "./usePostTreeCollapse";

function makePost(overrides: Partial<PostDTO> & { unitId: string }): PostDTO {
  return {
    authorUserId: "u1",
    targetUnitId: "target",
    content: markdownContentDoc(""),
    kind: "REPLY" as any,
    depth: 0,
    sortPath: "",
    replyCount: 0,
    directReplyCount: 0,
    ...overrides,
  } as PostDTO;
}

describe("usePostTreeCollapse helpers", () => {
  it("seedCollapsedIds collapses posts after three visible generations by default", () => {
    const posts = [
      makePost({ unitId: "a", depth: 0, sortPath: "01" }),
      makePost({ unitId: "b", depth: 1, sortPath: "01.01" }),
      makePost({ unitId: "c", depth: 2, sortPath: "01.01.01" }),
      makePost({ unitId: "d", depth: 3, sortPath: "01.01.01.01" }),
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
      makePost({ unitId: "a", sortPath: "01" }),
      makePost({ unitId: "b", sortPath: "01.01" }),
      makePost({ unitId: "c", sortPath: "01.01.01" }),
      makePost({ unitId: "d", sortPath: "02" }),
    ];

    expect(Array.from(getRevealExpandedIds(posts, "c"))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("seedCollapsedIds keeps the reveal path expanded", () => {
    const posts = [
      makePost({ unitId: "a", depth: 1, sortPath: "01" }),
      makePost({ unitId: "b", depth: 2, sortPath: "01.01" }),
      makePost({ unitId: "c", depth: 3, sortPath: "01.01.01" }),
      makePost({ unitId: "d", depth: 4, sortPath: "01.01.01.01" }),
    ];
    const ids = seedCollapsedIds(posts, { revealPostUnitId: "d" });

    expect(ids.has("c")).toBe(false);
    expect(ids.has("d")).toBe(false);
  });

  it("filterBySortPathPrefix hides descendants of collapsed posts by sortPath", () => {
    const posts = [
      makePost({ unitId: "a", sortPath: "01" }),
      makePost({ unitId: "b", sortPath: "01.01" }),
      makePost({ unitId: "c", sortPath: "01.01.01" }),
      makePost({ unitId: "d", sortPath: "02" }),
    ];
    const collapsed = new Set(["b"]);
    const visible = filterBySortPathPrefix(posts, collapsed);
    expect(visible.map((p) => p.unitId)).toEqual(["a", "b", "d"]);
  });

  it("filterBySortPathPrefix keeps collapsed post itself visible", () => {
    const posts = [
      makePost({ unitId: "a", sortPath: "01" }),
      makePost({ unitId: "b", sortPath: "01.01" }),
    ];
    const collapsed = new Set(["a"]);
    const visible = filterBySortPathPrefix(posts, collapsed);
    expect(visible.map((p) => p.unitId)).toEqual(["a"]);
  });

  it("filterBySortPathPrefix returns posts unchanged when nothing collapsed", () => {
    const posts = [
      makePost({ unitId: "a", sortPath: "01" }),
      makePost({ unitId: "b", sortPath: "01.01" }),
    ];
    const visible = filterBySortPathPrefix(posts, new Set());
    expect(visible).toBe(posts);
  });

  it("toggle flow: expanded root shows descendants; after re-collapse they hide again", () => {
    const posts = [
      makePost({ unitId: "a", sortPath: "01" }),
      makePost({ unitId: "b", sortPath: "01.01" }),
      makePost({ unitId: "c", sortPath: "01.01.01" }),
    ];
    let collapsed = new Set(["a"]);
    expect(
      filterBySortPathPrefix(posts, collapsed).map((p) => p.unitId),
    ).toEqual(["a"]);

    collapsed = new Set();
    expect(
      filterBySortPathPrefix(posts, collapsed).map((p) => p.unitId),
    ).toEqual(["a", "b", "c"]);

    collapsed = new Set(["a"]);
    expect(
      filterBySortPathPrefix(posts, collapsed).map((p) => p.unitId),
    ).toEqual(["a"]);
  });

  it("keeps nested collapsed state while an ancestor subtree is hidden", () => {
    const posts = [
      makePost({ unitId: "a", sortPath: "01" }),
      makePost({ unitId: "b", sortPath: "01.01" }),
      makePost({ unitId: "c", sortPath: "01.01.01" }),
      makePost({ unitId: "d", sortPath: "01.01.01.01" }),
    ];
    const collapsed = new Set(["a", "c"]);

    expect(
      filterBySortPathPrefix(posts, collapsed).map((p) => p.unitId),
    ).toEqual(["a"]);

    collapsed.delete("a");

    expect(
      filterBySortPathPrefix(posts, collapsed).map((p) => p.unitId),
    ).toEqual(["a", "b", "c"]);
  });
});

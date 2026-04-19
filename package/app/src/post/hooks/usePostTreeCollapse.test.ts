import type { PostDTO } from "@rezics/contract";
import { describe, expect, it } from "bun:test";
import {
  filterBySortPathPrefix,
  seedCollapsedIds,
} from "./usePostTreeCollapse";

function makePost(overrides: Partial<PostDTO> & { unitId: string }): PostDTO {
  return {
    authorUserId: "u1",
    targetUnitId: "target",
    body: "",
    kind: "REPLY" as any,
    depth: 0,
    sortPath: "",
    replyCount: 0,
    directReplyCount: 0,
    ...overrides,
  } as PostDTO;
}

describe("usePostTreeCollapse helpers", () => {
  it("seedCollapsedIds collapses posts with depth >= 2 by default", () => {
    const posts = [
      makePost({ unitId: "a", depth: 0, sortPath: "01" }),
      makePost({ unitId: "b", depth: 1, sortPath: "01.01" }),
      makePost({ unitId: "c", depth: 2, sortPath: "01.01.01" }),
      makePost({ unitId: "d", depth: 3, sortPath: "01.01.01.01" }),
    ];
    const ids = seedCollapsedIds(posts);
    expect(ids.has("a")).toBe(false);
    expect(ids.has("b")).toBe(false);
    expect(ids.has("c")).toBe(true);
    expect(ids.has("d")).toBe(true);
  });

  it("seedCollapsedIds respects custom defaultCollapseDepth", () => {
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
});

import { describe, expect, it } from "bun:test";
import { type CommentDTO, markdownContentDoc } from "@rezics/contract";
import {
  filterByCollapsedParents,
  getRevealExpandedIds,
  seedCollapsedIds,
} from "./useCommentTreeCollapse";

function makePost(
  overrides: Partial<CommentDTO> & { unitId: string },
): CommentDTO {
  const { unitId, ...rest } = overrides;
  return {
    id: unitId,
    unitId,
    rootUnitId: "root-1",
    realmUnitId: "realm-1",
    parentCommentId: null,
    authorUserId: "u1",
    content: markdownContentDoc(""),
    moderationStatus: "approved",
    depth: 0,
    replyCount: 0,
    directReplyCount: 0,
    ...rest,
  } as CommentDTO;
}

describe("useCommentTreeCollapse helpers", () => {
  it("seedCollapsedIds collapses posts after three visible generations by default", () => {
    const posts = [
      makePost({ unitId: "a", depth: 0 }),
      makePost({ unitId: "b", parentCommentId: "a", depth: 1 }),
      makePost({ unitId: "c", parentCommentId: "b", depth: 2 }),
      makePost({ unitId: "d", parentCommentId: "c", depth: 3 }),
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
      makePost({ unitId: "b", parentCommentId: "a", depth: 1 }),
      makePost({ unitId: "c", parentCommentId: "b", depth: 2 }),
    ];
    const ids = seedCollapsedIds(posts, 1);
    expect(ids.has("a")).toBe(false);
    expect(ids.has("b")).toBe(true);
    expect(ids.has("c")).toBe(true);
  });

  it("seedCollapsedIds applies visible generations relative to baseDepth", () => {
    const posts = [
      makePost({ unitId: "a", depth: 5 }),
      makePost({ unitId: "b", parentCommentId: "a", depth: 6 }),
      makePost({ unitId: "c", parentCommentId: "b", depth: 7 }),
    ];
    const ids = seedCollapsedIds(posts, {
      baseDepth: 4,
      defaultVisibleGenerations: 3,
    });

    expect(ids.has("a")).toBe(false);
    expect(ids.has("b")).toBe(false);
    expect(ids.has("c")).toBe(true);
  });

  it("getRevealExpandedIds returns the target node and loaded ancestors", () => {
    const posts = [
      makePost({ unitId: "a" }),
      makePost({ unitId: "b", parentCommentId: "a" }),
      makePost({ unitId: "c", parentCommentId: "b" }),
      makePost({ unitId: "d" }),
    ];

    expect(Array.from(getRevealExpandedIds(posts, "c"))).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("seedCollapsedIds keeps the reveal chain expanded", () => {
    const posts = [
      makePost({ unitId: "a", depth: 1 }),
      makePost({ unitId: "b", parentCommentId: "a", depth: 2 }),
      makePost({ unitId: "c", parentCommentId: "b", depth: 3 }),
      makePost({ unitId: "d", parentCommentId: "c", depth: 4 }),
    ];
    const ids = seedCollapsedIds(posts, { revealPostUnitId: "d" });

    expect(ids.has("c")).toBe(false);
    expect(ids.has("d")).toBe(false);
  });

  it("filterByCollapsedParents hides descendants of collapsed posts", () => {
    const posts = [
      makePost({ unitId: "a" }),
      makePost({ unitId: "b", parentCommentId: "a" }),
      makePost({ unitId: "c", parentCommentId: "b" }),
      makePost({ unitId: "d" }),
    ];
    const visible = filterByCollapsedParents(posts, new Set(["b"]));
    expect(visible.map((p) => p.unitId)).toEqual(["a", "b", "d"]);
  });

  it("filterByCollapsedParents keeps collapsed post itself visible", () => {
    const posts = [
      makePost({ unitId: "a" }),
      makePost({ unitId: "b", parentCommentId: "a" }),
    ];
    const visible = filterByCollapsedParents(posts, new Set(["a"]));
    expect(visible.map((p) => p.unitId)).toEqual(["a"]);
  });

  it("filterByCollapsedParents returns posts unchanged when nothing collapsed", () => {
    const posts = [
      makePost({ unitId: "a" }),
      makePost({ unitId: "b", parentCommentId: "a" }),
    ];
    const visible = filterByCollapsedParents(posts, new Set());
    expect(visible).toBe(posts);
  });

  it("keeps nested collapsed state while an ancestor subtree is hidden", () => {
    const posts = [
      makePost({ unitId: "a" }),
      makePost({ unitId: "b", parentCommentId: "a" }),
      makePost({ unitId: "c", parentCommentId: "b" }),
      makePost({ unitId: "d", parentCommentId: "c" }),
    ];
    const collapsed = new Set(["a", "c"]);

    expect(
      filterByCollapsedParents(posts, collapsed).map((p) => p.unitId),
    ).toEqual(["a"]);

    collapsed.delete("a");

    expect(
      filterByCollapsedParents(posts, collapsed).map((p) => p.unitId),
    ).toEqual(["a", "b", "c"]);
  });
});

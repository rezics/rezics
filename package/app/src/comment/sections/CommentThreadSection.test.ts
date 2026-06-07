import { describe, expect, it } from "bun:test";
import { type CommentDTO, markdownContentDoc } from "@rezics/contract";
import {
  buildCommentTreeNodes,
  type CommentTreeNodeModel,
  hasLaterSiblingBranch,
  mergeCommentChildSliceRows,
  mergeCommentDiscoveryRows,
  orderSiblingsByPromotion,
} from "../models/commentTreeRails";

function makePost(
  unitId: string,
  parentCommentId?: string | null,
  depth?: number,
): CommentDTO {
  return {
    id: unitId,
    unitId,
    rootUnitId: "root-1",
    realmUnitId: "realm-1",
    parentCommentId: parentCommentId ?? null,
    authorUserId: "user-1",
    content: markdownContentDoc("body"),
    moderationStatus: "approved",
    depth,
  } as CommentDTO;
}

function makePromotablePost(
  unitId: string,
  parentCommentId: string | null,
  pin?: { pinKind: CommentDTO["pinKind"]; pinPosition?: string },
): CommentDTO {
  return {
    ...makePost(unitId, parentCommentId, 1),
    pinKind: pin?.pinKind ?? null,
    pinPosition: pin?.pinPosition ?? null,
  } as CommentDTO;
}

function childIds(nodes: CommentTreeNodeModel[]): string[] {
  return nodes[0]?.children.map((child) => child.post.unitId) ?? [];
}

describe("CommentThreadSection helpers", () => {
  describe("buildCommentTreeNodes", () => {
    it("builds a nested DOM tree from loaded adjacency rows", () => {
      const aaa = makePost("aaa", null, 1);
      const bbb = makePost("bbb", "aaa", 2);
      const ccc = makePost("ccc", "bbb", 3);
      const ddd = makePost("ddd", "aaa", 2);
      const eee = makePost("eee", null, 1);

      const tree = buildCommentTreeNodes({
        posts: [aaa, bbb, ccc, ddd, eee],
        baseDepth: 0,
        maxDepth: 5,
        visualMaxDepth: 4,
      });

      expect(tree.map((node) => node.post.unitId)).toEqual(["aaa", "eee"]);
      expect(tree[0]?.children.map((node) => node.post.unitId)).toEqual([
        "bbb",
        "ddd",
      ]);
      expect(tree[0]?.children[0]?.children[0]?.post.unitId).toBe("ccc");
    });

    it("keeps rows with unloaded parents at the current slice root", () => {
      const child = makePost("child", "missing-parent", 3);

      const tree = buildCommentTreeNodes({
        posts: [child],
        baseDepth: 2,
        maxDepth: 5,
        visualMaxDepth: 4,
      });

      expect(tree.map((node) => node.post.unitId)).toEqual(["child"]);
      expect(tree[0]?.displayDepth).toBe(1);
    });

    it("caps display depth while preserving nested descendants", () => {
      const aaa = makePost("aaa", null, 1);
      const bbb = makePost("bbb", "aaa", 2);
      const ccc = makePost("ccc", "bbb", 3);

      const tree = buildCommentTreeNodes({
        posts: [aaa, bbb, ccc],
        baseDepth: 0,
        maxDepth: 5,
        visualMaxDepth: 2,
      });

      expect(tree[0]?.children[0]?.children[0]?.displayDepth).toBe(2);
      expect(tree[0]?.children[0]?.children[0]?.post.unitId).toBe("ccc");
    });
  });

  it("detects later direct sibling branches under a loaded parent", () => {
    const parent = makePost("parent");
    const first = makePost("first", "parent");
    const second = makePost("second", "parent");

    expect(hasLaterSiblingBranch([second], parent, first)).toBe(true);
  });

  it("merges discovery parent contexts before ranked hits without duplicates", () => {
    const parent = makePost("parent", null, 1);
    const child = makePost("child", "parent", 2);
    const nextChild = makePost("next-child", "parent", 2);

    expect(
      mergeCommentDiscoveryRows([
        { parentContexts: [parent], comments: [child] },
        { parentContexts: [parent], comments: [nextChild] },
      ]).map((post) => post.unitId),
    ).toEqual(["parent", "child", "next-child"]);
  });

  it("appends child slice pages under one parent without reordering rows", () => {
    const first = makePost("first", "parent", 2);
    const second = makePost("second", "parent", 2);
    const duplicateSecond = makePost("second", "parent", 2);
    const third = makePost("third", "parent", 2);

    expect(
      mergeCommentChildSliceRows([
        { comments: [first, second] },
        { comments: [duplicateSecond, third] },
      ]).map((post) => post.unitId),
    ).toEqual(["first", "second", "third"]);
  });
});

describe("post promotion overlay ordering", () => {
  const root = makePost("root", null, 0);

  it("orders accepted answers, then pins, then ordinary replies by base sort", () => {
    const posts = [
      root,
      makePromotablePost("ordinary-1", "root"),
      makePromotablePost("pinned-1", "root", {
        pinKind: "PINNED",
        pinPosition: "b",
      }),
      makePromotablePost("ordinary-2", "root"),
      makePromotablePost("accepted-1", "root", {
        pinKind: "ACCEPTED_ANSWER",
        pinPosition: "a",
      }),
    ];

    const nodes = buildCommentTreeNodes({
      posts,
      baseDepth: 0,
      maxDepth: 10,
      visualMaxDepth: 4,
    });

    expect(childIds(nodes)).toEqual([
      "accepted-1",
      "pinned-1",
      "ordinary-1",
      "ordinary-2",
    ]);
  });

  it("orders within a kind group by pinPosition ascending", () => {
    const group = [
      {
        post: makePromotablePost("a2", "root", {
          pinKind: "PINNED",
          pinPosition: "m",
        }),
        displayDepth: 1,
        atMaxDepth: false,
        children: [],
      },
      {
        post: makePromotablePost("a1", "root", {
          pinKind: "PINNED",
          pinPosition: "a",
        }),
        displayDepth: 1,
        atMaxDepth: false,
        children: [],
      },
    ];

    const ordered = orderSiblingsByPromotion(group);
    expect(ordered.map((node) => node.post.unitId)).toEqual(["a1", "a2"]);
  });

  it("propagates pinKind to the rendered node", () => {
    const posts = [
      root,
      makePromotablePost("accepted-1", "root", {
        pinKind: "ACCEPTED_ANSWER",
        pinPosition: "a",
      }),
    ];

    const nodes = buildCommentTreeNodes({
      posts,
      baseDepth: 0,
      maxDepth: 10,
      visualMaxDepth: 4,
    });

    expect(nodes[0]?.children[0]?.post.pinKind).toBe("ACCEPTED_ANSWER");
  });

  it("leaves a thread with no promotions in base order", () => {
    const posts = [
      root,
      makePromotablePost("r1", "root"),
      makePromotablePost("r2", "root"),
      makePromotablePost("r3", "root"),
    ];

    const nodes = buildCommentTreeNodes({
      posts,
      baseDepth: 0,
      maxDepth: 10,
      visualMaxDepth: 4,
    });

    expect(childIds(nodes)).toEqual(["r1", "r2", "r3"]);
  });
});

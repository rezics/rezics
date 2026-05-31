import { describe, expect, it } from "bun:test";
import { markdownContentDoc, type PostDTO } from "@rezics/contract";
import {
  buildPostTreeNodes,
  getChildBranchPrefix,
  getContinuationLines,
  hasLaterSiblingBranch,
  orderSiblingsByPromotion,
  type PostTreeNodeModel,
} from "../models/postTreeRails";

function makePost(unitId: string, path?: string, depth?: number): PostDTO {
  return {
    unitId,
    authorUserId: "user-1",
    content: markdownContentDoc("body"),
    path,
    depth,
  } as PostDTO;
}

function makePromotablePost(
  unitId: string,
  path: string,
  pin?: { pinKind: PostDTO["pinKind"]; pinPosition?: string },
): PostDTO {
  return {
    unitId,
    authorUserId: "user-1",
    content: markdownContentDoc("body"),
    path,
    depth: 1,
    pinKind: pin?.pinKind ?? null,
    pinPosition: pin?.pinPosition ?? null,
  } as PostDTO;
}

function childIds(nodes: PostTreeNodeModel[]): string[] {
  return nodes[0]?.children.map((child) => child.post.unitId) ?? [];
}

describe("PostTreeSection helpers", () => {
  describe("getChildBranchPrefix", () => {
    it("returns the child segment under the parent", () => {
      const xxx = makePost("xxx", "0001");
      const bbb = makePost("bbb", "0001.0001.0001");
      expect(getChildBranchPrefix(xxx, bbb)).toBe("0001.0001");
    });

    it("returns undefined when post is not a descendant", () => {
      const xxx = makePost("xxx", "0001");
      const sibling = makePost("sibling", "0002");
      expect(getChildBranchPrefix(xxx, sibling)).toBeUndefined();
    });
  });

  describe("cross-generation continuation (dot-separated)", () => {
    // Tree: xxx → aaaa → bbb, plus xxx → bbbb (sibling of aaaa after bbb)
    const xxx = makePost("xxx", "0001", 1);
    const aaaa = makePost("aaaa", "0001.0001", 2);
    const bbb = makePost("bbb", "0001.0001.0001", 3);
    const bbbb = makePost("bbbb", "0001.0002", 2);

    it("detects later sibling branch under xxx when bbbb follows bbb", () => {
      expect(hasLaterSiblingBranch([bbbb], xxx, bbb)).toBe(true);
    });

    it("keeps aaaa's parent-line continuing past the elbow", () => {
      expect(hasLaterSiblingBranch([bbb, bbbb], xxx, aaaa)).toBe(true);
    });

    it("gives bbb a level-1 continuation rail for xxx", () => {
      const lines = getContinuationLines({
        visibleBefore: [xxx, aaaa],
        visibleAfter: [bbbb],
        post: bbb,
        baseDepth: 0,
        visualMaxDepth: 4,
        parentLineLevel: 2,
      });
      expect(lines).toEqual([{ level: 1, postUnitId: "xxx" }]);
    });

    it("gives bbbb no extra continuations (parent line covers xxx)", () => {
      const lines = getContinuationLines({
        visibleBefore: [xxx, aaaa, bbb],
        visibleAfter: [],
        post: bbbb,
        baseDepth: 0,
        visualMaxDepth: 4,
        parentLineLevel: 1,
      });
      expect(lines).toEqual([]);
    });
  });

  describe("buildPostTreeNodes", () => {
    it("builds a nested DOM tree from flat threaded posts", () => {
      const aaa = makePost("aaa", "0001", 1);
      const bbb = makePost("bbb", "0001.0001", 2);
      const ccc = makePost("ccc", "0001.0001.0001", 3);
      const ddd = makePost("ddd", "0001.0002", 2);
      const eee = makePost("eee", "0002", 1);

      const tree = buildPostTreeNodes({
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

    it("caps display depth while preserving nested descendants", () => {
      const aaa = makePost("aaa", "0001", 1);
      const bbb = makePost("bbb", "0001.0001", 2);
      const ccc = makePost("ccc", "0001.0001.0001", 3);

      const tree = buildPostTreeNodes({
        posts: [aaa, bbb, ccc],
        baseDepth: 0,
        maxDepth: 5,
        visualMaxDepth: 2,
      });

      expect(tree[0]?.children[0]?.children[0]?.displayDepth).toBe(2);
      expect(tree[0]?.children[0]?.children[0]?.post.unitId).toBe("ccc");
    });
  });
});

describe("post promotion overlay ordering", () => {
  const root = makePost("root", "0001", 0);

  it("orders accepted answers, then pins, then ordinary replies by base sort", () => {
    const posts = [
      root,
      makePromotablePost("ordinary-1", "0001.0001"),
      makePromotablePost("pinned-1", "0001.0002", {
        pinKind: "PINNED",
        pinPosition: "b",
      }),
      makePromotablePost("ordinary-2", "0001.0003"),
      makePromotablePost("accepted-1", "0001.0004", {
        pinKind: "ACCEPTED_ANSWER",
        pinPosition: "a",
      }),
    ];

    const nodes = buildPostTreeNodes({
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
        post: makePromotablePost("a2", "0001.0002", {
          pinKind: "PINNED",
          pinPosition: "m",
        }),
        displayDepth: 1,
        atMaxDepth: false,
        children: [],
      },
      {
        post: makePromotablePost("a1", "0001.0001", {
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
      makePromotablePost("accepted-1", "0001.0001", {
        pinKind: "ACCEPTED_ANSWER",
        pinPosition: "a",
      }),
    ];

    const nodes = buildPostTreeNodes({
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
      makePromotablePost("r1", "0001.0001"),
      makePromotablePost("r2", "0001.0002"),
      makePromotablePost("r3", "0001.0003"),
    ];

    const nodes = buildPostTreeNodes({
      posts,
      baseDepth: 0,
      maxDepth: 10,
      visualMaxDepth: 4,
    });

    expect(childIds(nodes)).toEqual(["r1", "r2", "r3"]);
  });
});

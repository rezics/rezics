import { describe, expect, it } from "bun:test";
import type { PostDTO } from "@rezics/contract";
import { excludeRootPost } from "../hooks/usePostTreeCollapse";
import {
  buildPostTreeNodes,
  getChildBranchPrefix,
  getContinuationLines,
  hasLaterSiblingBranch,
} from "../models/postTreeRails";

function makePost(unitId: string, sortPath?: string, depth?: number): PostDTO {
  return {
    unitId,
    authorUserId: "user-1",
    body: "body",
    sortPath,
    depth,
  } as PostDTO;
}

describe("PostTreeSection helpers", () => {
  it("excludes the root post from the rendered reply tree", () => {
    const posts = [makePost("root"), makePost("reply-1"), makePost("reply-2")];

    expect(excludeRootPost(posts, "root").map((post) => post.unitId)).toEqual([
      "reply-1",
      "reply-2",
    ]);
  });

  describe("getChildBranchPrefix", () => {
    it("handles dot-separated sortPaths (server format)", () => {
      const xxx = makePost("xxx", "0001");
      const bbb = makePost("bbb", "0001.0001.0001");
      expect(getChildBranchPrefix(xxx, bbb)).toBe("0001.0001");
    });

    it("handles slash-separated sortPaths (factory format)", () => {
      const xxx = makePost("xxx", "0001");
      const bbb = makePost("bbb", "0001/0001/0001");
      expect(getChildBranchPrefix(xxx, bbb)).toBe("0001/0001");
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

import { describe, expect, test } from "bun:test";
import {
  buildShowcaseFeedPlan,
  buildLargePostTreePlan,
  FACTORY_SCENARIO_NAMES,
  FACTORY_SCENARIOS,
} from "./scenarios";
import { PostKind } from "./storage-values";

describe("factory scenarios", () => {
  test("registry exposes every scenario with defaults and runners", () => {
    expect(FACTORY_SCENARIO_NAMES).toEqual([
      "large-post-tree",
      "large-content-tree",
      "large-history",
      "complex-shelf",
      "wiki-zone-experience",
      "showcase-feed",
    ]);

    for (const name of FACTORY_SCENARIO_NAMES) {
      expect(FACTORY_SCENARIOS[name].defaultSelected).toBe(true);
      expect(typeof FACTORY_SCENARIOS[name].run).toBe("function");
      expect(FACTORY_SCENARIOS[name].description.length).toBeGreaterThan(0);
    }
  });
});

describe("buildShowcaseFeedPlan", () => {
  test("creates realm-scoped feed posts with review target context", () => {
    let nextId = 0;
    const plan = buildShowcaseFeedPlan({
      userId: "user-1",
      idFactory: () => `id-${++nextId}`,
      now: new Date("2026-06-05T12:00:00.000Z"),
    });

    expect(plan.works).toHaveLength(3);
    expect(plan.posts.map((post) => post.kind)).toEqual([
      PostKind.POST,
      PostKind.POST,
      PostKind.REVIEW,
      PostKind.REMARK,
      PostKind.EXCERPT,
    ]);

    const review = plan.posts.find((post) => post.kind === PostKind.REVIEW);
    expect(review?.targetUnitId).toBe(plan.works[0]?.unitId);
    expect(review?.extra).toMatchObject({
      book: { id: plan.works[0]?.unitId, title: plan.works[0]?.title },
    });
    expect(plan.realmMembershipUnitIds).toContain(review?.unitId);
    expect(plan.realmMembershipUnitIds).toContain(review?.targetUnitId);
    expect(plan.shelves.length).toBeGreaterThanOrEqual(2);
    expect(plan.comments).toHaveLength(2);
    expect(plan.comments[0]).toMatchObject({
      rootUnitId: plan.posts[0]?.unitId,
      depth: 1,
      directReplyCount: 1,
      replyCount: 1,
    });
    expect(plan.comments[1]).toMatchObject({
      rootUnitId: plan.posts[0]?.unitId,
      parentCommentId: plan.comments[0]?.id,
      depth: 2,
    });
    expect(plan.posts.map((post) => post.publishedAt.getTime())).toStrictEqual(
      [...plan.posts]
        .map((post) => post.publishedAt.getTime())
        .sort((a, b) => b - a),
    );
  });
});

describe("buildLargePostTreePlan", () => {
  test("creates a real nested tree with coherent parent, depth, and path", () => {
    const nodes = buildLargePostTreePlan({
      rootCount: 2,
      repliesPerRoot: 18,
      maxDepth: 4,
      branchCap: 3,
    });
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const roots = nodes.filter((node) => node.parentId == null);

    expect(roots).toHaveLength(2);
    expect(nodes).toHaveLength(38);
    expect(Math.max(...nodes.map((node) => node.depth))).toBeGreaterThanOrEqual(
      3,
    );

    for (const node of nodes) {
      if (!node.parentId) {
        expect(node.depth).toBe(0);
        expect(node.rootId).toBe(node.id);
        continue;
      }

      const parent = byId.get(node.parentId);
      expect(parent).toBeDefined();
      expect(node.rootId).toBe(parent!.rootId);
      expect(node.depth).toBe(parent!.depth + 1);
      expect(node.path.startsWith(`${parent!.path}.`)).toBe(true);
    }
  });

  test("derives direct and total reply counts from the generated tree", () => {
    const nodes = buildLargePostTreePlan({
      rootCount: 1,
      repliesPerRoot: 18,
      maxDepth: 4,
      branchCap: 3,
    });

    for (const node of nodes) {
      const directChildren = nodes.filter(
        (candidate) => candidate.parentId === node.id,
      );
      const descendants = nodes.filter(
        (candidate) =>
          candidate.id !== node.id &&
          candidate.rootId === node.rootId &&
          candidate.path.startsWith(`${node.path}.`),
      );

      expect(node.directReplyCount).toBe(directChildren.length);
      expect(node.replyCount).toBe(descendants.length);
    }
  });
});

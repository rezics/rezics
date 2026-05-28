import { describe, expect, test } from "bun:test";
import {
  buildLargePostTreePlan,
  FACTORY_SCENARIO_NAMES,
  FACTORY_SCENARIOS,
} from "./scenarios";

describe("factory scenarios", () => {
  test("registry exposes every scenario with defaults and runners", () => {
    expect(FACTORY_SCENARIO_NAMES).toEqual([
      "large-post-tree",
      "large-content-tree",
      "large-history",
      "complex-shelf",
      "unit-work-domain",
      "wiki-zone-experience",
    ]);

    for (const name of FACTORY_SCENARIO_NAMES) {
      expect(FACTORY_SCENARIOS[name].defaultSelected).toBe(true);
      expect(typeof FACTORY_SCENARIOS[name].run).toBe("function");
      expect(FACTORY_SCENARIOS[name].description.length).toBeGreaterThan(0);
    }
  });
});

describe("buildLargePostTreePlan", () => {
  test("creates a real nested tree with coherent parent, depth, and sortPath", () => {
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
      expect(node.sortPath.startsWith(`${parent!.sortPath}.`)).toBe(true);
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
          candidate.sortPath.startsWith(`${node.sortPath}.`),
      );

      expect(node.directReplyCount).toBe(directChildren.length);
      expect(node.replyCount).toBe(descendants.length);
    }
  });
});

import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import { SeedPlanSchema } from "./types";

const realisticPlan = {
  users: { min: 0, max: 200, target: 200 },
  tags: { min: 0, max: 400, target: 400 },
  books: { min: 0, max: 1000, target: 1000 },
  games: { min: 0, max: 1000, target: 1000 },
  media: { min: 0, max: 1000, target: 1000 },
  shelves: { min: 0, max: 500, target: 500 },
  realms: { min: 0, max: 20, target: 20 },
  zones: { min: 0, max: 40, target: 40 },
  personEntities: { min: 0, max: 800, target: 800 },
  organizationEntities: { min: 0, max: 200, target: 200 },
  followsPerUser: { min: 0, max: 5, target: 5 },
  favoriteItemsPerUser: { min: 0, max: 8, target: 8 },
  shelfItemCount: { min: 3, max: 150, alpha: 1.5 },
  scoresPerWork: { min: 3, max: 5, target: 5 },
  postsPerWork: {
    review: { min: 0, max: 50, alpha: 1.8 },
    excerpt: { min: 0, max: 15, alpha: 2.0 },
    remark: { min: 0, max: 10, alpha: 2.0 },
    tree: { min: 0, max: 120, alpha: 1.8 },
  },
  chapter: {
    count: { min: 5, max: 1200, alpha: 2.0 },
    unitProbability: 0.1,
  },
  treeShape: {
    roots: { min: 1, max: 10, alpha: 1.6 },
    depth: { min: 0, max: 4, alpha: 1.4 },
    branching: { min: 1, max: 5, alpha: 1.8 },
  },
};

describe("SeedPlanSchema", () => {
  test("parses a valid realistic plan", () => {
    expect(() => v.parse(SeedPlanSchema, realisticPlan)).not.toThrow();
  });

  test("rejects a plan missing max on a leaf and reports the path", () => {
    const broken = structuredClone(realisticPlan) as typeof realisticPlan;
    // @ts-expect-error testing invalid shape
    delete broken.postsPerWork.review.max;

    const result = v.safeParse(SeedPlanSchema, broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      const path = result.issues
        .flatMap((issue) => issue.path ?? [])
        .map((p) => p.key)
        .join(".");
      expect(path).toContain("postsPerWork");
      expect(path).toContain("review");
      expect(path).toContain("max");
    }
  });

  test("rejects unknown top-level keys", () => {
    const broken = { ...realisticPlan, mystery: 1 };
    expect(() => v.parse(SeedPlanSchema, broken)).toThrow();
  });
});

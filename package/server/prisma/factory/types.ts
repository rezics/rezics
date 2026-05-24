import * as v from "valibot";
import type { PostKind, UnitType } from "../generated/client.js";
import type { CountSpec, Mode } from "./strategy.js";
import { CountSpecSchema, ModeSchema } from "./strategy.js";

export const SEED_SYNC_TARGETS = [
  "content",
  "post",
  "realm",
  "user",
  "entity",
  "content-contained-units",
] as const;

export type SeedSyncTarget = (typeof SEED_SYNC_TARGETS)[number];

export interface SeedSyncSummary {
  targets: Record<SeedSyncTarget, number>;
  total: number;
}

export interface SeedSyncHooks {
  content(unitId: string): Promise<void>;
  post(unitId: string): Promise<void>;
  realm(unitId: string): Promise<void>;
  user(unitId: string): Promise<void>;
  entity(unitId: string): Promise<void>;
  contentContainedUnits(unitId: string): Promise<void>;
}

export interface SpecialSeedTarget {
  label: string;
  scenario: string;
  unitType: UnitType;
  unitId: string;
  notes?: string;
}

export interface SeedResult {
  specialTargets: SpecialSeedTarget[];
}

export interface CreatedUser {
  userId: string;
  name: string;
  slug: string;
}

export interface CreatedUnit {
  id: string;
  type: UnitType;
}

export interface CreatedEntity {
  unitId: string;
  name: string;
  kind: string;
  eligibleCreditRoles?: string[];
  eligibleSubjectRoles?: string[];
}

export interface CreatedPost extends CreatedUnit {
  kind: PostKind;
  targetUnitId?: string;
}

export interface PostsPerWorkPlan {
  review: CountSpec;
  excerpt: CountSpec;
  remark: CountSpec;
  tree: CountSpec;
}

export interface ChapterPlan {
  count: CountSpec;
  unitProbability: number;
  /**
   * Probability that a materialized chapter receives an additional
   * BookContentStructureNode row in the same book (multi-link fixture).
   * Defaults to 0 so existing seeds are unaffected.
   */
  multiLinkChapterProbability?: number;
}

export interface TreeShapePlan {
  roots: CountSpec;
  depth: CountSpec;
  branching: CountSpec;
}

export interface SeedPlan {
  users: CountSpec;
  tags: CountSpec;
  books: CountSpec;
  games: CountSpec;
  media: CountSpec;
  shelves: CountSpec;
  realms: CountSpec;
  zones: CountSpec;
  personEntities: CountSpec;
  organizationEntities: CountSpec;
  followsPerUser: CountSpec;
  favoriteItemsPerUser: CountSpec;
  shelfItemCount: CountSpec;
  scoresPerWork: CountSpec;
  postsPerWork: PostsPerWorkPlan;
  chapter: ChapterPlan;
  treeShape: TreeShapePlan;
}

export interface SeedPreset {
  mode: Mode;
  plan: SeedPlan;
}

export const PostsPerWorkPlanSchema = v.strictObject({
  review: CountSpecSchema,
  excerpt: CountSpecSchema,
  remark: CountSpecSchema,
  tree: CountSpecSchema,
});

export const ChapterPlanSchema = v.strictObject({
  count: CountSpecSchema,
  unitProbability: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  multiLinkChapterProbability: v.optional(
    v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  ),
});

export const TreeShapePlanSchema = v.strictObject({
  roots: CountSpecSchema,
  depth: CountSpecSchema,
  branching: CountSpecSchema,
});

export const SeedPlanSchema = v.strictObject({
  users: CountSpecSchema,
  tags: CountSpecSchema,
  books: CountSpecSchema,
  games: CountSpecSchema,
  media: CountSpecSchema,
  shelves: CountSpecSchema,
  realms: CountSpecSchema,
  zones: CountSpecSchema,
  personEntities: CountSpecSchema,
  organizationEntities: CountSpecSchema,
  followsPerUser: CountSpecSchema,
  favoriteItemsPerUser: CountSpecSchema,
  shelfItemCount: CountSpecSchema,
  scoresPerWork: CountSpecSchema,
  postsPerWork: PostsPerWorkPlanSchema,
  chapter: ChapterPlanSchema,
  treeShape: TreeShapePlanSchema,
});

export const SeedPresetSchema = v.strictObject({
  mode: ModeSchema,
  plan: SeedPlanSchema,
});

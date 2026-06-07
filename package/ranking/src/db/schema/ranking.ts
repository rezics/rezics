import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

const timestamp = () => p.timestamp({ precision: 3 });
const createdAt = () => timestamp().notNull().defaultNow();
const updatedAt = () => timestamp().notNull().defaultNow();

export const rankingScopeKindValues = [
  "global",
  "realm",
  "work",
  "tag",
  "parent",
] as const;
export const rankingRankKindValues = ["content", "post", "comment"] as const;
export const rankingSignalKindValues = ["view", "read"] as const;
export const rankingReactionKindValues = ["upvote", "downvote"] as const;
export const rankingPatchStatusValues = [
  "pending",
  "patched",
  "failed",
  "skipped",
] as const;

export const rankingScopeKind = p.pgEnum(
  "RankingScopeKind",
  rankingScopeKindValues,
);
export const rankingRankKind = p.pgEnum(
  "RankingRankKind",
  rankingRankKindValues,
);
export const rankingSignalKind = p.pgEnum(
  "RankingSignalKind",
  rankingSignalKindValues,
);
export const rankingReactionKind = p.pgEnum(
  "RankingReactionKind",
  rankingReactionKindValues,
);
export const rankingPatchStatus = p.pgEnum(
  "RankingPatchStatus",
  rankingPatchStatusValues,
);

export const unitRankProjections = p.pgTable(
  "UnitRankProjection",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    unitId: p.uuid("unitId").notNull(),
    scopeKind: rankingScopeKind("scopeKind").notNull(),
    scopeId: p.uuid("scopeId"),
    scopeKey: p.varchar("scopeKey", { length: 64 }).notNull(),
    rankKind: rankingRankKind("rankKind").notNull(),
    bestScore: p.doublePrecision("bestScore").notNull().default(0),
    hotScore: p.doublePrecision("hotScore").notNull().default(0),
    topScore: p.doublePrecision("topScore").notNull().default(0),
    risingScore: p.doublePrecision("risingScore").notNull().default(0),
    controversyScore: p
      .doublePrecision("controversyScore")
      .notNull()
      .default(0),
    trendingScore: p.doublePrecision("trendingScore").notNull().default(0),
    qualityScore: p.doublePrecision("qualityScore").notNull().default(0),
    formulaVersion: p.text("formulaVersion").notNull(),
    signalSnapshot: p.jsonb("signalSnapshot").notNull(),
    computedAt: timestamp().notNull().defaultNow(),
    rankUpdatedAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    p
      .uniqueIndex("UnitRankProjection_unitId_scopeKind_scopeKey_rankKind_key")
      .on(table.unitId, table.scopeKind, table.scopeKey, table.rankKind),
    p.index("UnitRankProjection_unitId_idx").on(table.unitId),
    p
      .index("UnitRankProjection_scopeKind_scopeId_rankKind_idx")
      .on(table.scopeKind, table.scopeId, table.rankKind),
    p
      .index("UnitRankProjection_rankKind_bestScore_idx")
      .on(table.rankKind, table.bestScore),
    p
      .index("UnitRankProjection_rankKind_hotScore_idx")
      .on(table.rankKind, table.hotScore),
    p
      .index("UnitRankProjection_rankKind_risingScore_idx")
      .on(table.rankKind, table.risingScore),
    p
      .index("UnitRankProjection_rankKind_controversyScore_idx")
      .on(table.rankKind, table.controversyScore),
    p
      .index("UnitRankProjection_rankKind_trendingScore_idx")
      .on(table.rankKind, table.trendingScore),
  ],
);

export const rankingSignalBuckets = p.pgTable(
  "RankingSignalBucket",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    unitId: p.uuid("unitId").notNull(),
    signalKind: rankingSignalKind("signalKind").notNull(),
    bucketStart: timestamp().notNull(),
    bucketEnd: timestamp().notNull(),
    count: p.integer("count").notNull().default(0),
    metadata: p.jsonb("metadata"),
    flushedAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    p
      .uniqueIndex("RankingSignalBucket_unitId_signalKind_bucketStart_key")
      .on(table.unitId, table.signalKind, table.bucketStart),
    p
      .index("RankingSignalBucket_signalKind_bucketStart_idx")
      .on(table.signalKind, table.bucketStart),
    p
      .index("RankingSignalBucket_unitId_flushedAt_idx")
      .on(table.unitId, table.flushedAt),
  ],
);

export const rankingReactionBuckets = p.pgTable(
  "RankingReactionBucket",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    targetId: p.uuid("targetId").notNull(),
    scopeKey: p.varchar("scopeKey", { length: 128 }).notNull(),
    reaction: rankingReactionKind("reaction").notNull(),
    bucketStart: timestamp().notNull(),
    bucketEnd: timestamp().notNull(),
    count: p.integer("count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    p
      .uniqueIndex(
        "RankingReactionBucket_target_scope_reaction_bucketStart_key",
      )
      .on(table.targetId, table.scopeKey, table.reaction, table.bucketStart),
    p
      .index("RankingReactionBucket_target_scope_bucketStart_idx")
      .on(table.targetId, table.scopeKey, table.bucketStart),
    p
      .index("RankingReactionBucket_reaction_bucketStart_idx")
      .on(table.reaction, table.bucketStart),
  ],
);

export const rankingFormulaVersions = p.pgTable("RankingFormulaVersion", {
  version: p.text("version").primaryKey(),
  rankKinds: p.text("rankKinds").array(),
  description: p.text("description"),
  config: p.jsonb("config").notNull(),
  active: p.boolean("active").notNull().default(false),
  createdAt: createdAt(),
});

export const servingPatchStatuses = p.pgTable(
  "ServingPatchStatus",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    projectionId: p
      .uuid("projectionId")
      .notNull()
      .references(() => unitRankProjections.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: p.uuid("unitId").notNull(),
    indexName: p.varchar("indexName", { length: 64 }).notNull(),
    documentId: p.uuid("documentId").notNull(),
    status: rankingPatchStatus("status").notNull().default("pending"),
    patchedAt: timestamp(),
    lastAttemptAt: timestamp(),
    retryCount: p.integer("retryCount").notNull().default(0),
    lastError: p.text("lastError"),
    source: p.jsonb("source"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    p.index("ServingPatchStatus_unitId_idx").on(table.unitId),
    p
      .index("ServingPatchStatus_indexName_documentId_idx")
      .on(table.indexName, table.documentId),
    p
      .index("ServingPatchStatus_status_lastAttemptAt_idx")
      .on(table.status, table.lastAttemptAt),
  ],
);

export type UnitRankProjectionRow = typeof unitRankProjections.$inferSelect;
export type NewUnitRankProjectionRow = typeof unitRankProjections.$inferInsert;
export type RankingSignalBucketRow = typeof rankingSignalBuckets.$inferSelect;
export type NewRankingSignalBucketRow =
  typeof rankingSignalBuckets.$inferInsert;
export type RankingReactionBucketRow =
  typeof rankingReactionBuckets.$inferSelect;
export type NewRankingReactionBucketRow =
  typeof rankingReactionBuckets.$inferInsert;
export type RankingFormulaVersionRow =
  typeof rankingFormulaVersions.$inferSelect;
export type NewRankingFormulaVersionRow =
  typeof rankingFormulaVersions.$inferInsert;
export type ServingPatchStatusRow = typeof servingPatchStatuses.$inferSelect;
export type NewServingPatchStatusRow = typeof servingPatchStatuses.$inferInsert;

import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

export const rankingScopeKindValues = [
  "global",
  "realm",
  "work",
  "tag",
  "parent",
] as const;
export const rankingRankKindValues = ["content", "post", "comment"] as const;
export const rankingSignalKindValues = ["view", "read"] as const;
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
    hotScore: p.doublePrecision("hotScore").notNull().default(0),
    topScore: p.doublePrecision("topScore").notNull().default(0),
    trendingScore: p.doublePrecision("trendingScore").notNull().default(0),
    qualityScore: p.doublePrecision("qualityScore").notNull().default(0),
    formulaVersion: p.text("formulaVersion").notNull(),
    signalSnapshot: p.jsonb("signalSnapshot").notNull(),
    computedAt: p
      .timestamp("computedAt", { precision: 3 })
      .notNull()
      .defaultNow(),
    rankUpdatedAt: p.timestamp("rankUpdatedAt", { precision: 3 }),
    createdAt: p
      .timestamp("createdAt", { precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: p.timestamp("updatedAt", { precision: 3 }).notNull(),
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
      .index("UnitRankProjection_rankKind_hotScore_idx")
      .on(table.rankKind, table.hotScore),
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
    bucketStart: p.timestamp("bucketStart", { precision: 3 }).notNull(),
    bucketEnd: p.timestamp("bucketEnd", { precision: 3 }).notNull(),
    count: p.integer("count").notNull().default(0),
    metadata: p.jsonb("metadata"),
    flushedAt: p.timestamp("flushedAt", { precision: 3 }),
    createdAt: p
      .timestamp("createdAt", { precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: p.timestamp("updatedAt", { precision: 3 }).notNull(),
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

export const rankingFormulaVersions = p.pgTable("RankingFormulaVersion", {
  version: p.text("version").primaryKey(),
  rankKinds: p.text("rankKinds").array(),
  description: p.text("description"),
  config: p.jsonb("config").notNull(),
  active: p.boolean("active").notNull().default(false),
  createdAt: p.timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
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
    patchedAt: p.timestamp("patchedAt", { precision: 3 }),
    lastAttemptAt: p.timestamp("lastAttemptAt", { precision: 3 }),
    retryCount: p.integer("retryCount").notNull().default(0),
    lastError: p.text("lastError"),
    source: p.jsonb("source"),
    createdAt: p
      .timestamp("createdAt", { precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: p.timestamp("updatedAt", { precision: 3 }).notNull(),
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
export type RankingFormulaVersionRow =
  typeof rankingFormulaVersions.$inferSelect;
export type NewRankingFormulaVersionRow =
  typeof rankingFormulaVersions.$inferInsert;
export type ServingPatchStatusRow = typeof servingPatchStatuses.$inferSelect;
export type NewServingPatchStatusRow = typeof servingPatchStatuses.$inferInsert;

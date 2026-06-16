import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

export const reactions = p.pgTable(
  "Reaction",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    userId: p.uuid("userId").notNull(),
    targetId: p.uuid("targetId").notNull(),
    reaction: p.varchar("reaction", { length: 32 }).notNull(),
    contextUnitId: p.uuid("contextUnitId"),
    createdAt: p.timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    p
      .uniqueIndex("Reaction_userId_targetId_reaction_direct_key")
      .on(table.userId, table.targetId, table.reaction)
      .where(sql`${table.contextUnitId} is null`),
    p
      .uniqueIndex("Reaction_userId_targetId_reaction_context_key")
      .on(table.userId, table.targetId, table.reaction, table.contextUnitId)
      .where(sql`${table.contextUnitId} is not null`),
    p.index("Reaction_targetId_idx").on(table.targetId),
    p
      .index("Reaction_targetId_reaction_idx")
      .on(table.targetId, table.reaction),
    p
      .index("Reaction_targetId_reaction_contextUnitId_idx")
      .on(table.targetId, table.reaction, table.contextUnitId),
    p.index("Reaction_userId_reaction_idx").on(table.userId, table.reaction),
    p.index("Reaction_userId_targetId_idx").on(table.userId, table.targetId),
    p.index("Reaction_userId_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

export const reactionSummaries = p.pgTable(
  "ReactionSummary",
  {
    targetId: p.uuid("targetId").notNull(),
    reaction: p.varchar("reaction", { length: 32 }).notNull(),
    contextUnitId: p.uuid("contextUnitId"),
    count: p.integer("count").notNull().default(0),
  },
  (table) => [
    p
      .uniqueIndex("ReactionSummary_targetId_reaction_direct_key")
      .on(table.targetId, table.reaction)
      .where(sql`${table.contextUnitId} is null`),
    p
      .uniqueIndex("ReactionSummary_targetId_reaction_context_key")
      .on(table.targetId, table.reaction, table.contextUnitId)
      .where(sql`${table.contextUnitId} is not null`),
    p.index("ReactionSummary_targetId_idx").on(table.targetId),
    p
      .index("ReactionSummary_targetId_reaction_idx")
      .on(table.targetId, table.reaction),
    p
      .index("ReactionSummary_targetId_reaction_contextUnitId_idx")
      .on(table.targetId, table.reaction, table.contextUnitId),
  ],
);

export const reactionTargetUsages = p.pgTable(
  "ReactionTargetUsage",
  {
    userId: p.uuid("userId").notNull(),
    targetId: p.uuid("targetId").notNull(),
    activeCount: p.integer("activeCount").notNull().default(0),
    maxActive: p.integer("maxActive").notNull().default(3),
  },
  (table) => [
    p.primaryKey({
      name: "ReactionTargetUsage_pkey",
      columns: [table.userId, table.targetId],
    }),
    p.index("ReactionTargetUsage_targetId_idx").on(table.targetId),
  ],
);

export const unitShares = p.pgTable(
  "UnitShare",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    userId: p.uuid("userId").notNull(),
    targetId: p.uuid("targetId").notNull(),
    createdAt: p.timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    p
      .uniqueIndex("UnitShare_userId_targetId_key")
      .on(table.userId, table.targetId),
    p.index("UnitShare_targetId_idx").on(table.targetId),
    p.index("UnitShare_userId_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

export const unitShareSummaries = p.pgTable("UnitShareSummary", {
  targetId: p.uuid("targetId").primaryKey(),
  shareCount: p.integer("shareCount").notNull().default(0),
});

export type ReactionRow = typeof reactions.$inferSelect;
export type NewReactionRow = typeof reactions.$inferInsert;
export type ReactionSummaryRow = typeof reactionSummaries.$inferSelect;
export type NewReactionSummaryRow = typeof reactionSummaries.$inferInsert;
export type ReactionTargetUsageRow = typeof reactionTargetUsages.$inferSelect;
export type NewReactionTargetUsageRow =
  typeof reactionTargetUsages.$inferInsert;
export type UnitShareRow = typeof unitShares.$inferSelect;
export type NewUnitShareRow = typeof unitShares.$inferInsert;
export type UnitShareSummaryRow = typeof unitShareSummaries.$inferSelect;
export type NewUnitShareSummaryRow = typeof unitShareSummaries.$inferInsert;

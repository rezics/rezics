import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

export const reactions = p.pgTable(
  "Reaction",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    userId: p.uuid("userId").notNull(),
    targetId: p.uuid("targetId").notNull(),
    reaction: p.varchar("reaction", { length: 32 }).notNull(),
    scopeKey: p
      .varchar("scopeKey", { length: 128 })
      .notNull()
      .default("direct"),
    createdAt: p.timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    p
      .uniqueIndex("Reaction_userId_targetId_reaction_scopeKey_key")
      .on(table.userId, table.targetId, table.reaction, table.scopeKey),
    p.index("Reaction_targetId_idx").on(table.targetId),
    p
      .index("Reaction_targetId_reaction_idx")
      .on(table.targetId, table.reaction),
    p
      .index("Reaction_targetId_reaction_scopeKey_idx")
      .on(table.targetId, table.reaction, table.scopeKey),
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
    scopeKey: p
      .varchar("scopeKey", { length: 128 })
      .notNull()
      .default("direct"),
    count: p.integer("count").notNull().default(0),
  },
  (table) => [
    p.primaryKey({
      name: "ReactionSummary_pkey",
      columns: [table.targetId, table.reaction, table.scopeKey],
    }),
    p.index("ReactionSummary_targetId_idx").on(table.targetId),
    p
      .index("ReactionSummary_targetId_reaction_idx")
      .on(table.targetId, table.reaction),
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

export type ReactionRow = typeof reactions.$inferSelect;
export type NewReactionRow = typeof reactions.$inferInsert;
export type ReactionSummaryRow = typeof reactionSummaries.$inferSelect;
export type NewReactionSummaryRow = typeof reactionSummaries.$inferInsert;
export type ReactionTargetUsageRow = typeof reactionTargetUsages.$inferSelect;
export type NewReactionTargetUsageRow =
  typeof reactionTargetUsages.$inferInsert;

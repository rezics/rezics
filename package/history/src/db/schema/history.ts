import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

export const revisionContents = p.pgTable("RevisionContent", {
  hash: p.varchar("hash", { length: 64 }).primaryKey(),
  payload: p.jsonb("payload").notNull(),
  createdAt: p.timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
});

export const unitRevisions = p.pgTable(
  "UnitRevision",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    unitId: p.uuid("unitId").notNull(),
    sequence: p.bigint("sequence", { mode: "bigint" }).notNull(),
    contentHash: p
      .varchar("contentHash", { length: 64 })
      .notNull()
      .references(() => revisionContents.hash, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    actorUserId: p.uuid("actorUserId").notNull(),
    message: p.text("message"),
    restoreSource: p.jsonb("restoreSource"),
    createdAt: p.timestamp("createdAt", { precision: 3 }).notNull(),
    ingestedAt: p
      .timestamp("ingestedAt", { precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p
      .uniqueIndex("UnitRevision_unitId_sequence_key")
      .on(table.unitId, table.sequence),
    p
      .index("UnitRevision_unitId_createdAt_idx")
      .on(table.unitId, table.createdAt.desc()),
    p
      .index("UnitRevision_actorUserId_createdAt_idx")
      .on(table.actorUserId, table.createdAt),
    p.index("UnitRevision_contentHash_idx").on(table.contentHash),
  ],
);

export const unitRevisionPaths = p.pgTable(
  "UnitRevisionPath",
  {
    unitId: p.uuid("unit_id").notNull(),
    sequence: p.bigint("sequence", { mode: "bigint" }).notNull(),
    path: p.text("path").notNull(),
    value: p.jsonb("value").notNull(),
    revisionId: p
      .uuid("revision_id")
      .notNull()
      .references(() => unitRevisions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    p.primaryKey({
      name: "UnitRevisionPath_pkey",
      columns: [table.unitId, table.sequence, table.path],
    }),
    p
      .index("UnitRevisionPath_unit_id_path_sequence_idx")
      .on(table.unitId, table.path, table.sequence.desc()),
    p.index("UnitRevisionPath_revision_id_idx").on(table.revisionId),
  ],
);

export const structureEvents = p.pgTable(
  "StructureEvent",
  {
    id: p.uuid("id").primaryKey().default(sql`uuidv7()`),
    unitId: p.uuid("unitId").notNull(),
    sequence: p.bigint("sequence", { mode: "bigint" }).notNull(),
    eventType: p.varchar("eventType", { length: 96 }).notNull(),
    actorUserId: p.uuid("actorUserId").notNull(),
    changedFieldKeys: p.text("changedFieldKeys").array().notNull(),
    payload: p.jsonb("payload").notNull(),
    message: p.text("message"),
    createdAt: p.timestamp("createdAt", { precision: 3 }).notNull(),
    ingestedAt: p
      .timestamp("ingestedAt", { precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    p
      .uniqueIndex("StructureEvent_unitId_sequence_eventType_key")
      .on(table.unitId, table.sequence, table.eventType),
    p
      .index("StructureEvent_unitId_createdAt_idx")
      .on(table.unitId, table.createdAt.desc()),
    p
      .index("StructureEvent_eventType_createdAt_idx")
      .on(table.eventType, table.createdAt),
  ],
);

export const ingestionCursors = p.pgTable("IngestionCursor", {
  source: p.varchar("source", { length: 64 }).primaryKey(),
  outboxId: p.uuid("outboxId"),
  updatedAt: p.timestamp("updatedAt", { precision: 3 }).notNull(),
});

export const outboxProcessingFailures = p.pgTable("OutboxProcessingFailure", {
  outboxId: p.uuid("outboxId").primaryKey(),
  attempts: p.integer("attempts").notNull().default(0),
  lastError: p.text("lastError"),
  retryAfter: p.timestamp("retryAfter", { precision: 3 }),
  createdAt: p.timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  updatedAt: p.timestamp("updatedAt", { precision: 3 }).notNull(),
});

export type RevisionContentRow = typeof revisionContents.$inferSelect;
export type NewRevisionContentRow = typeof revisionContents.$inferInsert;
export type UnitRevisionRow = typeof unitRevisions.$inferSelect;
export type NewUnitRevisionRow = typeof unitRevisions.$inferInsert;
export type UnitRevisionPathRow = typeof unitRevisionPaths.$inferSelect;
export type NewUnitRevisionPathRow = typeof unitRevisionPaths.$inferInsert;
export type StructureEventRow = typeof structureEvents.$inferSelect;
export type NewStructureEventRow = typeof structureEvents.$inferInsert;
export type IngestionCursorRow = typeof ingestionCursors.$inferSelect;
export type NewIngestionCursorRow = typeof ingestionCursors.$inferInsert;
export type OutboxProcessingFailureRow =
  typeof outboxProcessingFailures.$inferSelect;
export type NewOutboxProcessingFailureRow =
  typeof outboxProcessingFailures.$inferInsert;

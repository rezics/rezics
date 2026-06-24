import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";

const timestamp = () => p.timestamp({ precision: 3 });
const createdAt = () => timestamp().notNull().defaultNow();
const updatedAt = () => timestamp().notNull().defaultNow();

/**
 * Content-addressed payload for canonical editorial revisions. It stores final
 * revision content for history compare/restore and must not be used for draft
 * snapshots or autosave recovery data.
 * 规范编辑修订版本的内容寻址负载。存储用于历史比对/恢复的最终修订内容，
 * 不得用于草稿快照或自动保存的恢复数据。
 */
export const revisionContents = p.pgTable("RevisionContent", {
  hash: p.varchar("hash", { length: 64 }).primaryKey(),
  payload: p.jsonb("payload").notNull(),
  createdAt: createdAt(),
});

/**
 * Canonical editorial commit ingested from main HistoryOutbox. A revision is a
 * user-visible save of applied canonical state, not editor autosave, draft
 * storage, or an uncommitted frontend operation log.
 * 从主 HistoryOutbox 摄取的规范编辑提交。一次修订是已应用规范状态的用户可见保存，
 * 而非编辑器自动保存、草稿存储或未提交的前端操作日志。
 */
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
    // Event time is supplied by the producer; ingestion time records arrival.
    // 事件时间由生产者提供；摄取时间记录到达时刻。
    createdAt: timestamp().notNull(),
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

/**
 * Derived per-path snapshot index for editorial revision compare. Rows are
 * rebuilt from UnitRevision content and are not authoritative history state.
 * 用于编辑修订比对的派生式按路径快照索引。各行由 UnitRevision 内容重建，
 * 并非权威的历史状态。
 */
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

/**
 * Canonical high-change structure batch event ingested from main HistoryOutbox.
 * It represents semantic structure saves such as table-of-contents batches,
 * not every drag, click, or local editor operation.
 * 从主 HistoryOutbox 摄取的规范高变更结构批量事件。它代表语义化的结构保存，
 * 例如目录批量变更，而非每一次拖拽、点击或本地编辑器操作。
 */
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
    // Event time is supplied by the producer; ingestion time records arrival.
    // 事件时间由生产者提供；摄取时间记录到达时刻。
    createdAt: timestamp().notNull(),
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
  updatedAt: updatedAt(),
});

export const outboxProcessingFailures = p.pgTable("OutboxProcessingFailure", {
  outboxId: p.uuid("outboxId").primaryKey(),
  attempts: p.integer("attempts").notNull().default(0),
  lastError: p.text("lastError"),
  retryAfter: timestamp(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
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

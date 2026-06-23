import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  timestampMs,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns.ts";
import { ContentStructureNode } from "./content-structure.ts";
import { User } from "./identity.ts";
import { Post } from "./post.ts";
import { Unit } from "./unit.ts";

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const userUnitProgressStatusValues = [
  "BACKLOG",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
] as const;

export const UserUnitProgressStatus = pgEnum(
  "UserUnitProgressStatus",
  userUnitProgressStatusValues,
);

export const UserUnitProgress = pgTable(
  "UserUnitProgress",
  {
    id: uuidv7PrimaryKey(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    progress: doublePrecision().default(0).notNull(),
    status: UserUnitProgressStatus().default("BACKLOG").notNull(),
    isDeleted: boolean().default(false).notNull(),
    completedCount: integer().default(0).notNull(),
    totalTimeMs: bigint({ mode: "number" }).default(0).notNull(),
    firstSeenAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    lastSeenAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    lastReadNodeId: uuid().references(() => ContentStructureNode.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastReadAnchor: jsonData(),
  },
  (table) => [
    uniqueIndex("UserUnitProgress_userId_unitId_key").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("UserUnitProgress_lastReadNodeId_idx").using(
      "btree",
      table.lastReadNodeId.asc().nullsLast(),
    ),
    index("UserUnitProgress_unitId_status_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("UserUnitProgress_userId_isDeleted_lastSeenAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isDeleted.asc().nullsLast(),
      table.lastSeenAt.desc().nullsFirst(),
    ),
    index("UserUnitProgress_userId_lastSeenAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.lastSeenAt.desc().nullsFirst(),
    ),
  ],
);

export const UserUnitProgressPost = pgTable(
  "UserUnitProgressPost",
  {
    progressId: uuid()
      .notNull()
      .references(() => UserUnitProgress.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    postUnitId: uuid()
      .notNull()
      .references(() => Post.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    /**
     * Snapshot of UserUnitProgress.status when the post was linked.
     * 帖子被关联时 UserUnitProgress.status 的快照。
     */
    status: UserUnitProgressStatus().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.progressId, table.postUnitId],
      name: "UserUnitProgressPost_pkey",
    }),
    index("UserUnitProgressPost_postUnitId_idx").using(
      "btree",
      table.postUnitId.asc().nullsLast(),
    ),
    index("UserUnitProgressPost_progressId_status_idx").using(
      "btree",
      table.progressId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
  ],
);

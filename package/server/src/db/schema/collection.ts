import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import { ContentStructureNode } from "./content-structure";
import { UserUnitProgressStatus } from "./enums";
import { User } from "./identity";

export const UserUnitCollection = pgTable(
  "UserUnitCollection",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    searchText: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId],
      name: "UserUnitCollection_pkey",
    }),
    index("UserUnitCollection_unitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
    index("UserUnitCollection_userId_updatedAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.updatedAt.asc().nullsLast(),
    ),
  ],
);

export const UserUnitProgress = pgTable(
  "UserUnitProgress",
  {
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
    extra: jsonb(),
    firstSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastReadNodeId: uuid().references(() => ContentStructureNode.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastReadAnchor: jsonb(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId],
      name: "UserUnitProgress_pkey",
    }),
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

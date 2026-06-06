import { sql } from "drizzle-orm";
import { userUnitProgressStatusValues } from "@rezics/contract";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, timestampMs, updatedAt } from "./columns";
import { ContentStructureNode } from "./content-structure";
import { User } from "./identity";
import { Unit } from "./unit";

export const UserUnitProgressStatus = pgEnum(
  "UserUnitProgressStatus",
  userUnitProgressStatusValues,
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
    extra: jsonData(),
    firstSeenAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    lastSeenAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    lastReadNodeId: uuid().references(() => ContentStructureNode.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastReadAnchor: jsonData(),
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

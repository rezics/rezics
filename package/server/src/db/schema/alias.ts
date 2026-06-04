import { createdAt, updatedAt, uuidv7PrimaryKey } from "./columns";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { Unit } from "./catalog";
import { UnitAliasKind, UnitAliasStatus } from "./enums";
import { User } from "./identity";

export const SlugScope = pgTable(
  "SlugScope",
  {
    slug: text().primaryKey(),
    unitId: uuid().notNull(),
  },
  (table) => [
    uniqueIndex("SlugScope_unitId_key").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
  ],
);

export const UnitAlias = pgTable(
  "UnitAlias",
  {
    id: uuidv7PrimaryKey(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    value: text().notNull(),
    normalizedValue: text().notNull(),
    language: varchar({ length: 16 }),
    kind: UnitAliasKind().default("COMMON").notNull(),
    status: UnitAliasStatus().default("ACTIVE").notNull(),
    score: integer().default(0).notNull(),
    voteCount: integer().default(0).notNull(),
    pinned: boolean().default(false).notNull(),
    position: text(),
    createdById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    updatedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("UnitAlias_createdById_createdAt_idx").using(
      "btree",
      table.createdById.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UnitAlias_normalizedValue_idx").using(
      "btree",
      table.normalizedValue.asc().nullsLast(),
    ),
    index("UnitAlias_status_score_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
    uniqueIndex("UnitAlias_unitId_normalizedValue_key").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.normalizedValue.asc().nullsLast(),
    ),
    index("UnitAlias_unitId_pinned_position_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.pinned.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("UnitAlias_unitId_status_score_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
  ],
);

export const UnitAliasVote = pgTable(
  "UnitAliasVote",
  {
    aliasId: uuid()
      .notNull()
      .references(() => UnitAlias.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.aliasId, table.userId],
      name: "UnitAliasVote_pkey",
    }),
    index("UnitAliasVote_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
  ],
);

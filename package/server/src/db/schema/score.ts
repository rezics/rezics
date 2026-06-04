import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const ScoreAggregate = pgTable(
  "ScoreAggregate",
  {
    unitId: uuid().notNull(),
    realm: uuid().notNull(),
    totalScore: integer().default(0).notNull(),
    totalCount: integer().default(0).notNull(),
    distribution: jsonb().notNull(),
    fields: jsonb(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.realm],
      name: "ScoreAggregate_pkey",
    }),
  ],
);

export const ScoreEntry = pgTable(
  "ScoreEntry",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid().notNull(),
    unitId: uuid().notNull(),
    realm: uuid().notNull(),
    value: integer().notNull(),
    fields: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("ScoreEntry_unitId_realm_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.realm.asc().nullsLast(),
    ),
    index("ScoreEntry_userId_unitId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    uniqueIndex("ScoreEntry_userId_unitId_realm_key").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
      table.realm.asc().nullsLast(),
    ),
  ],
);

export const ScoreRealmField = pgTable(
  "ScoreRealmField",
  {
    realm: uuid().notNull(),
    key: varchar({ length: 64 }).notNull(),
    label: text(),
    sortOrder: integer().default(0).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.realm, table.key],
      name: "ScoreRealmField_pkey",
    }),
    index("ScoreRealmField_realm_sortOrder_idx").using(
      "btree",
      table.realm.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
  ],
);

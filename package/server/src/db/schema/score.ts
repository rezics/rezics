import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, updatedAt, uuidv7PrimaryKey } from "./columns";
export const ScoreAggregate = pgTable(
  "ScoreAggregate",
  {
    unitId: uuid().notNull(),
    realm: uuid().notNull(),
    totalScore: integer().default(0).notNull(),
    totalCount: integer().default(0).notNull(),
    distribution: jsonData().notNull(),
    fields: jsonData(),
    updatedAt: updatedAt(),
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
    id: uuidv7PrimaryKey(),
    userId: uuid().notNull(),
    unitId: uuid().notNull(),
    realm: uuid().notNull(),
    value: integer().notNull(),
    fields: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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

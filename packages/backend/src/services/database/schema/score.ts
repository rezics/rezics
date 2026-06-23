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
import { createdAt, jsonData, updatedAt, uuidv7PrimaryKey } from "./columns.ts";

/**
 * Per-bucket vote distribution: key = string-ified score, value = count.
 * 每桶投票分布：key = 字符串化的分数，value = 计数。
 */
export type ScoreDistribution = Record<string, number>;

/**
 * Per-field aggregate: total sum, count, and distribution.
 * 每字段聚合：总和、计数和分布。
 */
export interface ScoreFieldAggregate {
  total: number;
  count: number;
  dist: ScoreDistribution;
}

/**
 * Map of field key to its aggregate.
 * 字段键到其聚合的映射。
 */
export type ScoreFieldsAggregate = Record<string, ScoreFieldAggregate>;

export const ScoreAggregate = pgTable(
  "ScoreAggregate",
  {
    unitId: uuid().notNull(),
    realm: uuid().notNull(),
    totalScore: integer().default(0).notNull(),
    totalCount: integer().default(0).notNull(),
    distribution: jsonData<ScoreDistribution>().notNull(),
    fields: jsonData<ScoreFieldsAggregate | null>(),
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
    fields: jsonData<Record<string, number> | null>(),
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
    position: varchar({ length: 64 }).default("V").notNull(), // Fractional Indexing
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.realm, table.key],
      name: "ScoreRealmField_pkey",
    }),
    index("ScoreRealmField_realm_position_key_idx").using(
      "btree",
      table.realm.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.key.asc().nullsLast(),
    ),
  ],
);

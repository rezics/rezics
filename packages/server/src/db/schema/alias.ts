import { unitAliasKindValues, unitAliasStatusValues } from "@rezics/contract";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt, uuidv7PrimaryKey } from "./columns";
import { User } from "./identity";
import { Unit } from "./unit";

export const UnitAliasKind = pgEnum("UnitAliasKind", unitAliasKindValues);

export const UnitAliasStatus = pgEnum("UnitAliasStatus", unitAliasStatusValues);

/**
 * Maps named top-level slug scopes to placeholder SCOPE units. Owner-scoped
 * sub-resources bypass this table and use the owner Unit id as `slugScope`.
 * 将具名的顶级 slug scope 映射到占位的 SCOPE unit。归属者作用域下的子资源会
 * 绕过此表，直接用归属者 Unit id 作为 `slugScope`。
 */
export const SlugScope = pgTable(
  "SlugScope",
  {
    /**
     * Named scope key seeded once during infra bootstrap.
     * 在基础设施引导期间一次性写入的具名 scope key。
     */
    slug: text().primaryKey(),
    /**
     * Placeholder Unit whose id is the slugScope value for this top-level scope.
     * 占位 Unit，其 id 即为该顶级 scope 的 slugScope 值。
     */
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
    position: text(), // Fractional Indexing
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

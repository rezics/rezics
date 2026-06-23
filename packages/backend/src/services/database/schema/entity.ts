import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, textArray, updatedAt, uuidv7PrimaryKey } from "./columns.ts";
import { Unit } from "./unit.ts";

export const Entity = pgTable("Entity", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  kind: varchar({ length: 32 }),
  verified: boolean().default(false).notNull(),
  avatar: text(),
  eligibleCreditRoles: textArray().default(sql`ARRAY[]::text[]`).notNull(),
  eligibleSubjectRoles: textArray().default(sql`ARRAY[]::text[]`).notNull(),
});

export const UnitExternalLink = pgTable(
  "UnitExternalLink",
  {
    id: uuidv7PrimaryKey(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceEntityUnitId: uuid()
      .notNull()
      .references(() => Entity.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    url: text().notNull(),
    normalizedUrl: text(),
    normalizedUrlHash: varchar({ length: 64 }),
    role: varchar({ length: 32 }).default("related").notNull(),
    labelUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    fallbackText: text(),
    position: varchar({ length: 64 }).default("V").notNull(), // Fractional Indexing
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("UnitExternalLink_unitId_position_id_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("UnitExternalLink_unitId_sourceEntityUnitId_position_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.sourceEntityUnitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("UnitExternalLink_sourceEntityUnitId_unitId_idx").using(
      "btree",
      table.sourceEntityUnitId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("UnitExternalLink_labelUnitId_idx").using(
      "btree",
      table.labelUnitId.asc().nullsLast(),
    ),
    uniqueIndex("UnitExternalLink_unit_source_normalized_hash_key").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.sourceEntityUnitId.asc().nullsLast(),
      table.normalizedUrlHash.asc().nullsLast(),
    ),
  ],
);

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import { ContentTranslationStatus } from "./enums";

export const UnitTranslation = pgTable(
  "UnitTranslation",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    language: varchar({ length: 16 }).notNull(),
    title: text(),
    subtitle: text(),
    summary: text(),
    description: jsonb(),
    extra: jsonb(),
    sourceUnitId: uuid(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.language],
      name: "UnitTranslation_pkey",
    }),
    index("UnitTranslation_language_title_idx").using(
      "btree",
      table.language.asc().nullsLast(),
      table.title.asc().nullsLast(),
    ),
  ],
);

export const UnitSupportLanguage = pgTable(
  "UnitSupportLanguage",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    language: varchar({ length: 16 }).notNull(),
    isPrimary: boolean().default(false).notNull(),
    sortOrder: integer().default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.language],
      name: "UnitSupportLanguage_pkey",
    }),
    index("UnitSupportLanguage_language_unitId_idx").using(
      "btree",
      table.language.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
  ],
);

export const ContentTranslation = pgTable(
  "ContentTranslation",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    language: varchar({ length: 16 }).notNull(),
    content: jsonb().notNull(),
    status: ContentTranslationStatus().default("PUBLISHED").notNull(),
    sourceUnitId: uuid(),
    authorUserId: uuid(),
    provenance: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.language],
      name: "ContentTranslation_pkey",
    }),
    index("ContentTranslation_authorUserId_idx").using(
      "btree",
      table.authorUserId.asc().nullsLast(),
    ),
    index("ContentTranslation_language_status_idx").using(
      "btree",
      table.language.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("ContentTranslation_sourceUnitId_idx").using(
      "btree",
      table.sourceUnitId.asc().nullsLast(),
    ),
    index("ContentTranslation_status_updatedAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.updatedAt.asc().nullsLast(),
    ),
  ],
);

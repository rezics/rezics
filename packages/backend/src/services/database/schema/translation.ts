import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, updatedAt } from "./columns.ts";
import { Unit } from "./unit.ts";

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const contentTranslationStatusValues = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const ContentTranslationStatus = pgEnum(
  "ContentTranslationStatus",
  contentTranslationStatusValues,
);

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
    /**
     * Rich ContentDoc JSON.
     * 富文本 ContentDoc JSON。
     */
    description: jsonData(),
    extra: jsonData(),
    /** Optional provenance Unit for the translation's display/content source.
     * 可选的来源 Unit，用于标记该翻译的展示/内容出处。 */
    sourceUnitId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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
    position: varchar({ length: 64 }).default("V").notNull(), // Fractional Indexing
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
    index("UnitSupportLanguage_unitId_position_language_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.language.asc().nullsLast(),
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
    content: jsonData().notNull(),
    status: ContentTranslationStatus().default("PUBLISHED").notNull(),
    /**
     * Optional hooks for source/provenance migration.
     * 用于来源/出处迁移的可选挂钩。
     */
    sourceUnitId: uuid(),
    authorUserId: uuid(),
    provenance: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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

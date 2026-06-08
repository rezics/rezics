import { contentTranslationStatusValues } from "@rezics/contract";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, updatedAt } from "./columns";
import { Unit } from "./unit";

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
     * Rich ContentDoc JSON. Search projections such as descriptionText are
     * Meilisearch-only and must not be added as PostgreSQL columns.
     * 富文本 ContentDoc JSON。诸如 descriptionText 的搜索投影仅存在于
     * Meilisearch，不得作为 PostgreSQL 列加入。
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
    content: jsonData().notNull(),
    status: ContentTranslationStatus().default("PUBLISHED").notNull(),
    /**
     * Optional hooks for source/provenance migration. These scalar ids do not
     * imply ownership or source validation rules.
     * 用于来源/出处迁移的可选挂钩。这些标量 id 不蕴含所有权或来源校验规则。
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

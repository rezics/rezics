import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns.ts";
import { User } from "./identity.ts";
import { ModerationStatus } from "./moderation.ts";

export const unitTypeStorageValues = [
  "BOOK",
  "GAME",
  "MEDIA",
  "POST",
  "TAG",
  "REALM",
  "SHELF",
  "IMAGE",
  "VIDEO",
  "QUOTE",
  "LINK",
  "ENTITY",
  "ZONE",
  "USER",
  "SCOPE",
  "SERIES",
  "LABEL",
  "POLL",
  "COMMENT",
] as const;

export type UnitTypeStorage = (typeof unitTypeStorageValues)[number];

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const unitStatusValues = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
  "DELETED",
] as const;

const unitVisibilityValues = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

const contentRatingValues = [
  "GENERAL",
  "R_15",
  "R_18",
  "R_18G",
] as const;

const aiDisclosureModeValues = [
  "UNKNOWN",
  "NONE",
  "AI_ASSISTED",
  "AI_ORIGINATED",
  "MACHINE_GENERATED",
] as const;

const catalogEntryKindValues = ["MAIN", "VARIANT", "NONE"] as const;

/**
 * Unified persisted Unit types.
 * 统一持久化的 Unit 类型。
 */
export const UnitType = pgEnum("UnitType", unitTypeStorageValues);

export const UnitStatus = pgEnum("UnitStatus", unitStatusValues);

export const UnitVisibility = pgEnum("UnitVisibility", unitVisibilityValues);

export const ContentRating = pgEnum("ContentRating", contentRatingValues);

export const AiDisclosureMode = pgEnum(
  "AiDisclosureMode",
  aiDisclosureModeValues,
);

export const CatalogEntryKind = pgEnum(
  "CatalogEntryKind",
  catalogEntryKindValues,
);

/**
 * Core Unit identity and shared catalog state.
 * Unit 的核心身份与共享目录状态。
 */
export const Unit = pgTable(
  "Unit",
  {
    id: uuidv7PrimaryKey(),
    type: UnitType().notNull(),
    slug: text(),
    /**
     * Slug namespace key.
     * Slug 命名空间键。
     */
    slugScope: uuid().notNull(),
    userId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    defaultLanguage: varchar({ length: 16 }),
    /**
     * Language-independent units bypass UnitSupportLanguage and match any language filter.
     * 与语言无关的 unit 绕过 UnitSupportLanguage，并匹配任意语言过滤器。
     */
    isLanguageNeutral: boolean().default(false).notNull(),
    status: UnitStatus().default("DRAFT").notNull(),
    visibility: UnitVisibility().default("PUBLIC").notNull(),
    rating: ContentRating().default("GENERAL").notNull(),
    extra: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: nullableTimestamp(),
    /**
     * Denormalized count of Subscription rows targeting this unit.
     * 指向此 unit 的 Subscription 行的反范式化计数。
     */
    subscriberCount: integer().default(0).notNull(),
    referenceCount: integer().default(0).notNull(),
    /**
     * Publication license slug from the contract registry.
     * 来自 contract registry 的发布许可 slug。
     */
    licenseSlug: text(),
    /**
     * Declared AI involvement/provenance for public-facing content.
     * 面向公众内容所声明的 AI 参与情况／来源。
     */
    aiDisclosureMode: AiDisclosureMode().default("UNKNOWN").notNull(),
    aiDisclosureDetails: jsonData(),
    /**
     * Native catalog identity for discovery.
     * 用于发现的原生目录身份。
     */
    catalogEntryKind: CatalogEntryKind(),
    /**
     * Canonical weak target edge for a Unit whose normal interactions resolve to another Unit.
     * 当某个 Unit 的普通交互解析到另一个 Unit 时使用的规范化弱目标边。
     */
    targetUnitId: uuid(),
    moderationStatus: ModerationStatus().default("APPROVED").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetUnitId],
      foreignColumns: [table.id],
      name: "Unit_targetUnitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("Unit_catalogEntryKind_targetUnitId_idx").using(
      "btree",
      table.catalogEntryKind.asc().nullsLast(),
      table.targetUnitId.asc().nullsLast(),
    ),
    index("Unit_defaultLanguage_idx").using(
      "btree",
      table.defaultLanguage.asc().nullsLast(),
    ),
    index("Unit_moderationStatus_idx").using(
      "btree",
      table.moderationStatus.asc().nullsLast(),
    ),
    uniqueIndex("Unit_slugScope_slug_key").using(
      "btree",
      table.slugScope.asc().nullsLast(),
      table.slug.asc().nullsLast(),
    ),
    index("Unit_slugScope_type_idx").using(
      "btree",
      table.slugScope.asc().nullsLast(),
      table.type.asc().nullsLast(),
    ),
    index("Unit_status_visibility_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.visibility.asc().nullsLast(),
    ),
    index("Unit_targetUnitId_idx").using(
      "btree",
      table.targetUnitId.asc().nullsLast(),
    ),
    index("Unit_type_status_createdAt_idx").using(
      "btree",
      table.type.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Unit_userId_createdAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    check(
      "Unit_series_catalogEntryKind_check",
      sql`((type <> 'SERIES'::"UnitType") OR ("catalogEntryKind" IS NULL))`,
    ),
    check(
      "Unit_variant_targetUnitId_check",
      sql`(("catalogEntryKind" <> 'VARIANT'::"CatalogEntryKind") OR ("targetUnitId" IS NOT NULL))`,
    ),
  ],
);

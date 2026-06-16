import {
  aiDisclosureModeValues,
  catalogEntryKindValues,
  contentRatingValues,
  unitStatusValues,
  unitVisibilityValues,
} from "@rezics/contract";
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
} from "./columns";
import { User } from "./identity";
import { ModerationStatus } from "./moderation";

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

/**
 * Unified persisted Unit types. USER rows are type-extension markers whose
 * `User.unitId` equals `Unit.id`; SCOPE rows back named slug namespaces and
 * use null slugs.
 * 统一持久化的 Unit 类型。USER 行是类型扩展标记，其 `User.unitId` 等于
 * `Unit.id`；SCOPE 行支撑具名 slug 命名空间并使用空 slug。
 */
export const UnitType = pgEnum("UnitType", unitTypeStorageValues);

// DELETED is a soft-delete marker. Units are never hard-deleted; read paths
// must filter it out when deleted content should be hidden.
// DELETED 是软删除标记。Unit 永不被硬删除；当应隐藏已删除内容时，读取路径
// 必须将其过滤掉。
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
 * Core Unit identity and shared catalog state. Type-specific rows extend this
 * table one-to-one where needed.
 * Unit 的核心身份与共享目录状态。需要时，类型专属的行以一对一方式扩展此表。
 */
export const Unit = pgTable(
  "Unit",
  {
    id: uuidv7PrimaryKey(),
    type: UnitType().notNull(),
    slug: text(),
    /**
     * Slug namespace key. Top-level slugs point at placeholder SCOPE units for
     * named scopes such as user, realm, tag, zone, and entity; owner-scoped
     * sub-resources use the owner Unit id directly.
     * Slug 命名空间键。顶层 slug 指向用于 user、realm、tag、zone、entity 等具名
     * 作用域的占位 SCOPE unit；归属作用域的子资源直接使用归属者的 Unit id。
     */
    slugScope: uuid().notNull(),
    userId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    defaultLanguage: varchar({ length: 16 }),
    /**
     * Language-independent units, such as tags, bypass UnitSupportLanguage and
     * match any language filter.
     * 与语言无关的 unit（例如 tag）绕过 UnitSupportLanguage，并匹配任意语言过滤器。
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
     * Denormalized count of Subscription rows targeting this unit. Maintained
     * transactionally by the subscription service to avoid counting on every
     * unit-detail read.
     * 指向此 unit 的 Subscription 行的反范式化计数。由订阅服务在事务中维护，
     * 以避免在每次读取 unit 详情时进行计数。
     */
    subscriberCount: integer().default(0).notNull(),
    referenceCount: integer().default(0).notNull(),
    /**
     * Publication license slug from the contract registry. Nullable during
     * rollout; readers may treat null as the platform default when an effective
     * license is required.
     * 来自 contract registry 的发布许可 slug。在推广期间可为空；当需要有效许可
     * 时，读取方可将空值视为平台默认值。
     */
    licenseSlug: text(),
    /**
     * Declared AI involvement/provenance for public-facing content. UNKNOWN is
     * the default because historical data must not imply a no-AI claim.
     * 面向公众内容所声明的 AI 参与情况／来源。默认值为 UNKNOWN，因为历史数据
     * 不得隐含“未使用 AI”的声明。
     */
    aiDisclosureMode: AiDisclosureMode().default("UNKNOWN").notNull(),
    aiDisclosureDetails: jsonData(),
    /**
     * Native catalog identity for discovery. MAIN rows are ordinary native
     * catalog entries; VARIANT rows use `targetUnitId` to point at the main
     * catalog Unit.
     * 用于发现的原生目录身份。MAIN 行是普通的原生目录条目；VARIANT 行使用
     * `targetUnitId` 指向主目录 Unit。
     */
    catalogEntryKind: CatalogEntryKind(),
    /**
     * Canonical weak target edge for a Unit whose normal interactions,
     * aggregation, or "about" relation resolve to another Unit.
     *
     * Catalog VARIANT rows point to the main catalog Unit. POST rows use this
     * as the owning Post extension's aggregation target. Normal interactions
     * starting from a VARIANT target the main catalog Unit; only progress and
     * rating may target a VARIANT directly.
     *
     * This is not ownership, containment, ordering, discussion topology, realm
     * membership, moderation state, or a generic edge table. This is also the
     * only persisted column that may use the generic `targetUnitId` name;
     * domain-specific endpoints must use domain-specific field names.
     *
     * 当某个 Unit 的普通交互、聚合或“about”关系解析到另一个 Unit 时，使用此
     * 规范化的弱目标边。
     *
     * 目录 VARIANT 行指向主目录 Unit。POST 行将其用作所属 Post 扩展的聚合目标。
     * 从 VARIANT 发起的普通交互以主目录 Unit 为目标；只有进度和评分可以直接以
     * VARIANT 为目标。
     *
     * 这不是归属、包含、排序、讨论拓扑、realm 成员关系、审核状态，也不是通用
     * 边表。这也是唯一允许使用通用名称 `targetUnitId` 的持久化列；领域专属端点
     * 必须使用领域专属的字段名。
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

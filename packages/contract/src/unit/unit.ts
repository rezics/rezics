import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { contentLanguageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import {
  listGetQueryBase,
  listPostBodyBase,
  readLanguageBodyBase,
  readLanguageGetQueryBase,
} from "../list-query-base";

// ============================================================
// ENUMS
// 枚举
// ============================================================

/**
 * Unit type contract. IMAGE units are cataloged image works, such as
 * Pixiv-like artworks with attribution, tags, and discussion. Ordinary or
 * decorative images are plain URL strings on the object that owns them.
 * Unit 类型契约。IMAGE unit 表示可编目的图片作品，例如带有归属、标签与讨论的
 * Pixiv 类作品。普通图片或装饰图片只是其所属对象上的 URL 字符串。
 */
export const UnitType = {
  BOOK: "BOOK",
  GAME: "GAME",
  MEDIA: "MEDIA",
  POST: "POST",
  COMMENT: "COMMENT",
  TAG: "TAG",
  REALM: "REALM",
  SHELF: "SHELF",
  SERIES: "SERIES",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  QUOTE: "QUOTE",
  LINK: "LINK",
  ENTITY: "ENTITY",
  ZONE: "ZONE",
  USER: "USER",
  SCOPE: "SCOPE",
  LABEL: "LABEL",
  POLL: "POLL",
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const UnitStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;

export const unitStatusValues = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
  "DELETED",
] as const;

export const UnitVisibility = {
  PUBLIC: "PUBLIC",
  UNLISTED: "UNLISTED",
  PRIVATE: "PRIVATE",
} as const;

export const unitVisibilityValues = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

export const unitTypeSchema = t.Union([
  t.Literal("BOOK"),
  t.Literal("GAME"),
  t.Literal("MEDIA"),
  t.Literal("POST"),
  t.Literal("COMMENT"),
  t.Literal("TAG"),
  t.Literal("REALM"),
  t.Literal("SHELF"),
  t.Literal("SERIES"),
  t.Literal("IMAGE"),
  t.Literal("VIDEO"),
  t.Literal("QUOTE"),
  t.Literal("LINK"),
  t.Literal("ENTITY"),
  t.Literal("ZONE"),
  t.Literal("USER"),
  t.Literal("SCOPE"),
  t.Literal("LABEL"),
  t.Literal("POLL"),
]);

/**
 * Unit types that represent cataloged works. These are the Unit-level source
 * of truth for work cover presentation and collaborative catalog/wiki editing.
 * 表示可编目作品的 Unit 类型。这是作品封面展示与协作式目录/wiki 编辑的
 * Unit 级事实来源。
 */
export const CATALOG_UNIT_TYPES = [
  UnitType.BOOK,
  UnitType.GAME,
  UnitType.MEDIA,
] as const;

export type CatalogUnitType = (typeof CATALOG_UNIT_TYPES)[number];

export const catalogUnitTypeSchema = t.Union([
  t.Literal(UnitType.BOOK),
  t.Literal(UnitType.GAME),
  t.Literal(UnitType.MEDIA),
]);

export function isCatalogUnitType(type: string): type is CatalogUnitType {
  return (CATALOG_UNIT_TYPES as readonly string[]).includes(type);
}

/**
 * Catalog work cover aspect ratio (width / height) by Unit type. Keep values
 * independent even where they match so a single catalog type can change without
 * affecting the others.
 * 按 Unit 类型定义的目录作品封面宽高比（宽 / 高）。即使数值相同也保持
 * 独立，以便单一目录类型可以更改而不影响其他类型。
 */
export const CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE = {
  [UnitType.BOOK]: 2 / 3,
  [UnitType.GAME]: 2 / 3,
  [UnitType.MEDIA]: 2 / 3,
} as const satisfies Record<CatalogUnitType, number>;

/**
 * Unit types that participate in collaborative catalog/wiki editing.
 * 参与协作式目录/wiki 编辑的 Unit 类型。
 */
export const WIKI_TYPES = CATALOG_UNIT_TYPES;

export type WikiType = CatalogUnitType;

export const wikiTypeSchema = catalogUnitTypeSchema;

export const unitStatusSchema = t.Union([
  t.Literal("DRAFT"),
  t.Literal("PUBLISHED"),
  t.Literal("ARCHIVED"),
  t.Literal("DELETED"),
]);

export const unitVisibilitySchema = t.Union([
  t.Literal("PUBLIC"),
  t.Literal("UNLISTED"),
  t.Literal("PRIVATE"),
]);

// ============================================================
// CONTENT RATING
// 内容分级
// ============================================================

export const ContentRating = {
  GENERAL: "GENERAL",
  R_15: "R_15",
  R_18: "R_18",
  R_18G: "R_18G",
} as const;

export const contentRatingValues = [
  "GENERAL",
  "R_15",
  "R_18",
  "R_18G",
] as const;

export type ContentRating = (typeof ContentRating)[keyof typeof ContentRating];

export const contentRatingSchema = t.Union([
  t.Literal("GENERAL"),
  t.Literal("R_15"),
  t.Literal("R_18"),
  t.Literal("R_18G"),
]);

// ============================================================
// AI DISCLOSURE
// AI 披露
// ============================================================

export const AiDisclosureMode = {
  UNKNOWN: "UNKNOWN",
  NONE: "NONE",
  AI_ASSISTED: "AI_ASSISTED",
  AI_ORIGINATED: "AI_ORIGINATED",
  MACHINE_GENERATED: "MACHINE_GENERATED",
} as const;

export const aiDisclosureModeValues = [
  "UNKNOWN",
  "NONE",
  "AI_ASSISTED",
  "AI_ORIGINATED",
  "MACHINE_GENERATED",
] as const;

export type AiDisclosureMode =
  (typeof AiDisclosureMode)[keyof typeof AiDisclosureMode];

export const aiDisclosureModeSchema = t.Union([
  t.Literal("UNKNOWN"),
  t.Literal("NONE"),
  t.Literal("AI_ASSISTED"),
  t.Literal("AI_ORIGINATED"),
  t.Literal("MACHINE_GENERATED"),
]);

export const CatalogEntryKind = {
  MAIN: "MAIN",
  VARIANT: "VARIANT",
  NONE: "NONE",
} as const;

export const catalogEntryKindValues = ["MAIN", "VARIANT", "NONE"] as const;

export type CatalogEntryKind =
  (typeof CatalogEntryKind)[keyof typeof CatalogEntryKind];

export const catalogEntryKindSchema = t.Union([
  t.Literal("MAIN"),
  t.Literal("VARIANT"),
  t.Literal("NONE"),
]);

export const aiDisclosureSourceSchema = t.Union([
  t.Literal("USER"),
  t.Literal("MODERATOR"),
  t.Literal("SYSTEM"),
  t.Literal("IMPORT"),
]);

export const aiDisclosureSourceStandardSchema = t.Union([
  t.Literal("C2PA"),
  t.Literal("IPTC"),
  t.Literal("SELF_DECLARED"),
  t.Literal("OTHER"),
]);

export const aiDisclosureDetailsSchema = t.Object(
  {
    model: t.Optional(t.String()),
    provider: t.Optional(t.String()),
    reviewedByHuman: t.Optional(t.Boolean()),
    disclosedBy: t.Optional(aiDisclosureSourceSchema),
    sourceStandard: t.Optional(aiDisclosureSourceStandardSchema),
  },
  { additionalProperties: false },
);

export type AiDisclosureDetails = (typeof aiDisclosureDetailsSchema)["static"];

// ============================================================
// PUBLIC USER (shared across contracts)
// PUBLIC USER（跨各契约共享）
// ============================================================

export const publicUserSchema = t.Object({
  /** Canonical user identifier — the USER `Unit.id`. 规范的用户标识符——即 USER 的 `Unit.id`。 */
  unitId: t.String(),
  slug: t.Optional(t.String()),
  name: t.Optional(t.String()),
  avatar: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
  followersCount: t.Optional(t.Number()),
  followingsCount: t.Optional(t.Number()),
});

export type PublicUser = (typeof publicUserSchema)["static"];

// ============================================================
// UNIT TRANSLATION DTO
// UNIT 翻译 DTO
// ============================================================

export const unitTranslationDTOSchema = t.Object({
  unitId: t.String(),
  language: contentLanguageSchema,
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceUnitId: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitTranslationDTO = (typeof unitTranslationDTOSchema)["static"];

export const variantContextSummarySchema = t.Object({
  unitId: t.String(),
  title: t.String(),
});

export type VariantContextSummary =
  (typeof variantContextSummarySchema)["static"];

// ============================================================
// UNIT PUBLICATION METADATA
// UNIT 发布元数据
// ============================================================

export const unitPublicationMetadataSchema = t.Object({
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
});

export type UnitPublicationMetadata =
  (typeof unitPublicationMetadataSchema)["static"];

export const publishableUnitInputSchema = t.Object({
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
});

export type PublishableUnitInput =
  (typeof publishableUnitInputSchema)["static"];

export const unitSupportLanguageDTOSchema = t.Object({
  unitId: t.String(),
  language: contentLanguageSchema,
  isPrimary: t.Boolean(),
  position: t.String(), // Fractional Indexing
});

export type UnitSupportLanguageDTO =
  (typeof unitSupportLanguageDTOSchema)["static"];

// ============================================================
// UNIT DTO
// UNIT DTO 数据传输对象
// ============================================================

export const baseUnitSchema = t.Object({
  id: t.String(),
  type: t.String(),
  slug: t.Optional(t.Nullable(t.String())),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  isLanguageNeutral: t.Optional(t.Boolean()),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  // Canonical weak target edge for the Unit's primary aggregation/about target.
  // Variants require it, but non-variant Unit extensions such as POST may also
  // project it when their interactions resolve to another Unit.
  // Unit 主聚合/about 目标的规范弱目标边。Variant 必须有它，但 POST 这类
  // 非 variant 的 Unit 扩展，在其交互解析到另一个 Unit 时也可能投影出它。
  targetUnitId: t.Optional(t.Nullable(t.String())),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  publishedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  referenceCount: t.Optional(t.Number()),
  shareCount: t.Optional(t.Number()),
});

export type BaseUnit = (typeof baseUnitSchema)["static"];

export const unitDTOSchema = t.Object({
  ...baseUnitSchema.properties,
  resolvedLanguage: t.Optional(t.Nullable(contentLanguageSchema)),
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  supportLanguages: t.Optional(t.Array(unitSupportLanguageDTOSchema)),
});

export type UnitDTO = (typeof unitDTOSchema)["static"];

// ============================================================
// UNIT LIST/QUERY
// UNIT 列表/查询
// ============================================================

export const unitListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  ...readLanguageGetQueryBase.properties,
  q: t.Optional(t.String()),
  id: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  title: t.Optional(t.String()),
  type: t.Optional(t.String()),
  types: t.Optional(t.String()),
  excludeTypes: t.Optional(t.String()),
  status: t.Optional(t.String()),
  statuses: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  userIds: t.Optional(t.String()),
  language: t.Optional(contentLanguageSchema),
  rating: t.Optional(contentRatingSchema),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
  publishedAtFrom: t.Optional(t.String()),
  publishedAtTo: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type UnitListQuery = (typeof unitListQuerySchema)["static"];

export const unitListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  ...readLanguageBodyBase.properties,
  q: t.Optional(t.String()),
  id: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  title: t.Optional(t.String()),
  type: t.Optional(t.String()),
  types: t.Optional(t.String()),
  excludeTypes: t.Optional(t.String()),
  status: t.Optional(t.String()),
  statuses: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  userIds: t.Optional(t.String()),
  language: t.Optional(contentLanguageSchema),
  rating: t.Optional(contentRatingSchema),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
  publishedAtFrom: t.Optional(t.String()),
  publishedAtTo: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type UnitListBody = (typeof unitListBodySchema)["static"];

export const unitListResponseSchema = t.Object({
  units: t.Array(unitDTOSchema),
  total: t.Optional(t.Number()),
});

export type UnitListResponse = (typeof unitListResponseSchema)["static"];

export const unitParamsSchema = t.Object({
  unitId: t.String(),
});

export type UnitParams = (typeof unitParamsSchema)["static"];

export const unitResponseSchema = unitDTOSchema;
export type UnitResponse = (typeof unitResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE UNIT
// 创建/更新 UNIT
// ============================================================

export const createUnitSchema = t.Object({
  userId: t.Optional(t.String()),
  type: t.String(),
  isLanguageNeutral: t.Optional(t.Boolean()),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  // The owning Unit stores canonical target semantics; extension tables must
  // not duplicate this as their own persisted target column.
  // 拥有方 Unit 存储规范的目标语义；扩展表不得将其作为自己持久化的目标列重复存储。
  targetUnitId: t.Optional(t.Nullable(t.String())),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  publishedAt: t.Optional(t.Union([t.String(), t.Date()])),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: contentLanguageSchema,
        title: t.Optional(t.String()),
        subtitle: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        description: t.Optional(contentDocWriteSchema),
        extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
        sourceUnitId: t.Optional(t.String()),
      }),
    ),
  ),
});

export type CreateUnitInput = (typeof createUnitSchema)["static"];

export const updateUnitSchema = t.Object({
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  publishedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
});

export type UpdateUnitInput = (typeof updateUnitSchema)["static"];

// ============================================================
// TRANSLATION CRUD
// 翻译 CRUD
// ============================================================

export const createTranslationSchema = t.Object({
  language: contentLanguageSchema,
  title: t.Optional(t.String()),
  subtitle: t.Optional(t.String()),
  summary: t.Optional(t.String()),
  description: t.Optional(contentDocWriteSchema),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceUnitId: t.Optional(t.String()),
});

export type CreateTranslationInput = (typeof createTranslationSchema)["static"];

export const updateTranslationSchema = t.Object({
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocWriteSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceUnitId: t.Optional(t.Nullable(t.String())),
});

export type UpdateTranslationInput = (typeof updateTranslationSchema)["static"];

export const translationParamsSchema = t.Object({
  unitId: t.String(),
  language: contentLanguageSchema,
});

export type TranslationParams = (typeof translationParamsSchema)["static"];

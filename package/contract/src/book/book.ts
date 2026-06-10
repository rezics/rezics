import { t } from "elysia";
import { creationModeSchema } from "../content/authority";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import {
  type ContentStructureItem,
  type ContentStructurePath,
  type ContentStructureResponse,
  contentStructureDTOSchema,
  contentStructureNodeSchema,
} from "../content/structure";
import { creditAttributionBriefSchema } from "../entity/credit-attribution";
import { languageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import {
  listGetQueryBase,
  listPostBodyBase,
  readLanguageBodyBase,
  readLanguageGetQueryBase,
} from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import {
  aiDisclosureDetailsSchema,
  aiDisclosureModeSchema,
  catalogEntryKindSchema,
  contentRatingSchema,
  publicUserSchema,
  unitTranslationDTOSchema,
} from "../unit/unit";

// ============================================================
// BOOK EXTRA SCHEMA
// 图书扩展 SCHEMA
// ============================================================

/**
 * @compat additive-only
 * Book.extra read shape. Missing `publishURL` means no known publication URLs;
 * unknown keys are tolerated for additive evolution.
 */
export const bookExtraSchema = t.Object(
  {
    publishURL: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: true },
);

export type BookExtra = (typeof bookExtraSchema)["static"];

// ============================================================
// BOOK DTO
// 图书 DTO
// ============================================================

export const bookDTOSchema = t.Object({
  unitId: t.String(),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  defaultLanguage: t.Optional(t.Nullable(languageSchema)),
  resolvedLanguage: t.Optional(t.Nullable(languageSchema)),
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  referenceCount: t.Optional(t.Number()),
  shareCount: t.Optional(t.Number()),

  // Book extension fields
  // 图书扩展字段
  isbn13: t.Optional(t.Nullable(t.String())),
  publicationDate: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  pageCount: t.Optional(t.Nullable(t.Number())),
  textLength: t.Optional(t.Number()),
  chapterCount: t.Optional(t.Number()),
  formatKey: t.Optional(t.Nullable(t.String())),
  isLicensed: t.Optional(t.Boolean()),
  coverUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(bookExtraSchema)),

  // Translation layer
  // 翻译层
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),

  // Credit attribution
  // 署名信息
  creditAttributions: t.Optional(t.Array(creditAttributionBriefSchema)),

  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  publishedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
});

export type BookDTO = (typeof bookDTOSchema)["static"];

// ============================================================
// BOOK LIST/QUERY
// 图书列表/查询
// ============================================================

export const bookListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  ...readLanguageGetQueryBase.properties,
  rating: t.Optional(contentRatingSchema),
  language: t.Optional(languageSchema),
  tagUnitIds: t.Optional(t.String()),
  entityId: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  isbn13: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  status: t.Optional(t.String()),
  moderationStatus: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(t.String()),
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
  limit: paginationLimitSchema,
});

export type BookListQuery = (typeof bookListQuerySchema)["static"];

export const bookListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  ...readLanguageBodyBase.properties,
  rating: t.Optional(contentRatingSchema),
  language: t.Optional(languageSchema),
  tagUnitIds: t.Optional(t.String()),
  entityId: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  isbn13: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  status: t.Optional(t.String()),
  moderationStatus: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(t.String()),
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
  limit: paginationLimitSchema,
});

export type BookListBody = (typeof bookListBodySchema)["static"];

export const bookListResponseSchema = t.Object({
  books: t.Array(bookDTOSchema),
  total: t.Optional(t.Number()),
});

export type BookListResponse = (typeof bookListResponseSchema)["static"];

// ============================================================
// BOOK PARAMS/RESPONSE
// 图书参数/响应
// ============================================================

export const bookParamsSchema = t.Object({
  unitId: t.String(),
});

export type BookParams = (typeof bookParamsSchema)["static"];

export const bookReadQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
  explicitLanguage: t.Optional(languageSchema),
});

export type BookReadQuery = (typeof bookReadQuerySchema)["static"];

export const bookResponseSchema = bookDTOSchema;
export type BookResponse = (typeof bookResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE BOOK
// 创建/更新图书
// ============================================================

export const createBookSchema = t.Object({
  userId: t.Optional(t.String()),
  creationMode: t.Optional(creationModeSchema),
  defaultLanguage: t.Optional(languageSchema),
  isbn13: t.Optional(t.String()),
  publicationDate: t.Optional(t.Union([t.String(), t.Date()])),
  pageCount: t.Optional(t.Number()),
  textLength: t.Optional(t.Number()),
  formatKey: t.Optional(t.String()),
  isLicensed: t.Optional(t.Boolean()),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  coverUrl: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  visibility: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
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

export type CreateBookInput = (typeof createBookSchema)["static"];

export const updateBookSchema = t.Object({
  isbn13: t.Optional(t.Nullable(t.String())),
  publicationDate: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  pageCount: t.Optional(t.Nullable(t.Number())),
  textLength: t.Optional(t.Number()),
  formatKey: t.Optional(t.Nullable(t.String())),
  isLicensed: t.Optional(t.Boolean()),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  coverUrl: t.Optional(t.Nullable(t.String())),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  visibility: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateBookInput = (typeof updateBookSchema)["static"];

// ============================================================
// BOOK CONTENT STRUCTURE / CHAPTER TREE TYPES
// 图书内容结构 / 章节树类型
// ============================================================

export const bookContentStructureNodeSchema = contentStructureNodeSchema;

/**
 * Path to a node occurrence in the current BookContentStructure forest.
 *
 * `[2, 4, 0]` means the first child of the fifth child of the third root node.
 * A path locates a node in the current JSON structure only; it is not a stable
 * global identity and may become stale after TOC edits or reordering.
 *
 * 指向当前 BookContentStructure 森林中某个节点出现位置的路径。
 *
 * `[2, 4, 0]` 表示第三个根节点的第五个子节点的第一个子节点。
 * 路径仅在当前 JSON 结构内定位节点；它不是稳定的全局标识，在目录
 * 编辑或重排序后可能失效。
 */
export type BookContentStructurePath = ContentStructurePath;

export type BookContentStructureItem = ContentStructureItem;

export const bookContentStructureDTOSchema = t.Object({
  bookUnitId: t.String(),
  ownerUnitId: t.Optional(t.String()),
  nodes: contentStructureDTOSchema.properties.nodes,
  createdAt: contentStructureDTOSchema.properties.createdAt,
  updatedAt: contentStructureDTOSchema.properties.updatedAt,
});

export type BookContentStructureDTO =
  (typeof bookContentStructureDTOSchema)["static"];

export interface BookContentStructureResponse
  extends Omit<ContentStructureResponse, "ownerUnitId"> {
  bookUnitId: string;
  ownerUnitId?: string;
}

import type { Static } from "elysia";
import { t } from "elysia";
import { creditAttributionRoleKeySchema } from "../entity/credit-attribution";
import { entityKindKeySchema } from "../entity/entity";
import { subjectAttributionRoleKeySchema } from "../entity/subject-attribution";
import { languageSchema } from "../language";

// ANCHOR: Entity Search Document
// ANCHOR: 实体搜索文档

export const EntitySearchDocumentSchema = t.Object({
  /**
   * Primary key for the Meili `entities` index — equals `Unit.id`.
   * Meili `entities` 索引的主键——等于 `Unit.id`。
   */
  id: t.String(),
  unitId: t.String(),
  kind: t.Union([t.String(), t.Null()]),
  verified: t.Boolean(),
  slug: t.Union([t.String(), t.Null()]),
  ownerUnitId: t.Union([t.String(), t.Null()]),
  avatar: t.Union([t.String(), t.Null()]),

  // Searchable arrays (denormalized from UnitTranslation)
  // 可搜索数组（从 UnitTranslation 反规范化而来）
  titles: t.Array(t.String()),
  summaries: t.Array(t.String()),
  aliasValues: t.Array(t.String()),

  // Entity-owned eligibility facets
  // Entity 自有的资格分面
  eligibleCreditRoles: t.Array(creditAttributionRoleKeySchema),
  eligibleSubjectRoles: t.Array(subjectAttributionRoleKeySchema),

  // Structured translations for display rendering
  // 用于展示渲染的结构化翻译
  translations: t.Array(
    t.Object({
      language: languageSchema,
      title: t.Union([t.String(), t.Null()]),
      subtitle: t.Union([t.String(), t.Null()]),
      summary: t.Union([t.String(), t.Null()]),
    }),
  ),

  createdAt: t.String(),
  updatedAt: t.String(),
});

export type EntitySearchDocument = Static<typeof EntitySearchDocumentSchema>;

export const EntitySearchOptionsSchema = t.Object({
  q: t.Optional(t.String()),
  kind: t.Optional(entityKindKeySchema),
  verified: t.Optional(t.Boolean()),
  ownerUnitId: t.Optional(t.String()),
  eligibleCreditRole: t.Optional(creditAttributionRoleKeySchema),
  eligibleSubjectRole: t.Optional(subjectAttributionRoleKeySchema),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type EntitySearchOptions = Static<typeof EntitySearchOptionsSchema>;

export const EntitySearchResultSchema = t.Object({
  entities: t.Array(EntitySearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type EntitySearchResult = Static<typeof EntitySearchResultSchema>;

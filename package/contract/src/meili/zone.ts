import type { Static } from "elysia";
import { t } from "elysia";
import { languageSchema } from "../language";
import { readLanguageBodyBase } from "../list-query-base";

// ANCHOR: Zone Search Document
// ANCHOR: Zone 搜索文档

export const ZoneSearchDocumentSchema = t.Object({
  id: t.String(),
  slug: t.Union([t.String(), t.Null()]),
  ownerRealmUnitId: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  startsAt: t.Union([t.String(), t.Null()]),
  endsAt: t.Union([t.String(), t.Null()]),
  userId: t.Union([t.String(), t.Null()]),
  visibility: t.String(),
  languages: t.Array(languageSchema),
  isLanguageNeutral: t.Boolean(),
  supportLanguages: t.Array(
    t.Object({
      language: languageSchema,
      isPrimary: t.Optional(t.Boolean()),
      sortOrder: t.Optional(t.Number()),
    }),
  ),

  // Searchable arrays (denormalized from UnitTranslation and owner realm)
  // 可搜索数组（从 UnitTranslation 和所属 realm 反规范化而来）
  titles: t.Array(t.String()),
  descriptions: t.Array(t.String()),
  aliasValues: t.Array(t.String()),
  ownerRealmTitles: t.Array(t.String()),

  // Structured translations for display rendering
  // 用于展示渲染的结构化译文
  translations: t.Array(
    t.Object({
      language: languageSchema,
      title: t.Union([t.String(), t.Null()]),
      description: t.Union([t.String(), t.Null()]),
    }),
  ),

  resolvedLanguage: t.Optional(t.Union([languageSchema, t.Null()])),
  title: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.Union([t.String(), t.Null()])),
});

export type ZoneSearchDocument = Static<typeof ZoneSearchDocumentSchema>;

// ANCHOR: Zone Search Options
// ANCHOR: Zone 搜索选项

export const ZoneSearchOptionsSchema = t.Object({
  ...readLanguageBodyBase.properties,
  keyword: t.Optional(t.String()),
  ownerRealmUnitId: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type ZoneSearchOptions = Static<typeof ZoneSearchOptionsSchema>;

// ANCHOR: Zone Search Result
// ANCHOR: Zone 搜索结果

export const ZoneSearchResultSchema = t.Object({
  items: t.Array(ZoneSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type ZoneSearchResult = Static<typeof ZoneSearchResultSchema>;

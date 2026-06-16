import type { Static } from "elysia";
import { t } from "elysia";
import { languageSchema } from "../language";
import { readLanguageBodyBase } from "../list-query-base";

// ANCHOR: Realm Search Document
// ANCHOR: Realm 搜索文档

export const RealmSearchDocumentSchema = t.Object({
  id: t.String(),
  isPublic: t.Boolean(),
  isOfficial: t.Boolean(),
  memberCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
  userId: t.Union([t.String(), t.Null()]),
  languages: t.Array(languageSchema),
  isLanguageNeutral: t.Boolean(),
  supportLanguages: t.Array(
    t.Object({
      language: languageSchema,
      isPrimary: t.Optional(t.Boolean()),
      position: t.Optional(t.String()), // Fractional Indexing
    }),
  ),

  // Searchable arrays (denormalized from UnitTranslation)
  // 可搜索数组（从 UnitTranslation 反规范化而来）
  titles: t.Array(t.String()),
  descriptions: t.Array(t.String()),
  aliasValues: t.Array(t.String()),

  // Structured translations for display rendering
  // 用于展示渲染的结构化译文
  translations: t.Array(
    t.Object({
      language: languageSchema,
      title: t.Union([t.String(), t.Null()]),
      description: t.Union([t.String(), t.Null()]),
    }),
  ),

  // Extra
  // 额外字段
  extra: t.Optional(t.Any()),
  resolvedLanguage: t.Optional(t.Union([languageSchema, t.Null()])),
  title: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.Union([t.String(), t.Null()])),
});

export type RealmSearchDocument = Static<typeof RealmSearchDocumentSchema>;

// ANCHOR: Realm Search Options
// ANCHOR: Realm 搜索选项

export const RealmSearchOptionsSchema = t.Object({
  ...readLanguageBodyBase.properties,
  keyword: t.Optional(t.String()),
  isPublic: t.Optional(t.Boolean()),
  isOfficial: t.Optional(t.Boolean()),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("memberCount"),
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

export type RealmSearchOptions = Static<typeof RealmSearchOptionsSchema>;

// ANCHOR: Realm Search Result
// ANCHOR: Realm 搜索结果

export const RealmSearchResultSchema = t.Object({
  items: t.Array(RealmSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type RealmSearchResult = Static<typeof RealmSearchResultSchema>;

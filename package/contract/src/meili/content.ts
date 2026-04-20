import type { Static } from "elysia";
import { t } from "elysia";
import { TagRefSchema } from "../common/tag-ref";
import { languageSchema } from "../language";
import { postKindLiterals } from "../post";

// ANCHOR: Content Search Document

export const ContentSearchDocumentSchema = t.Object({
  // Identity
  id: t.String(),
  type: t.String(),

  // Searchable text (denormalized from UnitTranslation)
  titles: t.Array(t.String()),
  subtitles: t.Array(t.String()),
  summaries: t.Array(t.String()),
  descriptions: t.Array(t.String()),

  // Searchable attribution (denormalized from Attribution → Entity translations)
  creditNames: t.Array(t.String()),

  // Searchable tag labels (denormalized from tag Unit translations)
  tagLabels: t.Array(t.String()),

  // Filterable: tag system (from UnitTag)
  tagIds: t.Array(t.String()),
  tagScores: t.Record(t.String(), t.Number()),

  // Filterable: realm system (from RealmUnit)
  realmIds: t.Array(t.String()),

  // Filterable: realm-tag system (from RealmTagUnit)
  realmTagKeys: t.Array(t.String()),

  // Filterable: metadata
  languages: t.Array(t.String()),
  nsfw: t.Boolean(),
  visibility: t.String(),
  isLicensed: t.Boolean(),

  // Filterable: post kind (null for non-POST units)
  postKind: t.Union([postKindLiterals, t.Null()]),

  // Filterable: text length (null for non-book units)
  textLength: t.Union([t.Number(), t.Null()]),

  // Sortable
  createdAt: t.String(),
  updatedAt: t.String(),
  publishedAt: t.Union([t.String(), t.Null()]),

  // Result display fields
  defaultLanguage: t.Union([languageSchema, t.Null()]),
  coverUrl: t.Union([t.String(), t.Null()]),
  userId: t.Union([t.String(), t.Null()]),

  // Link-specific display fields
  linkUrl: t.Optional(t.Union([t.String(), t.Null()])),
  linkSiteName: t.Optional(t.Union([t.String(), t.Null()])),

  // Structured translations for language-aware rendering
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Union([t.String(), t.Null()]),
        subtitle: t.Union([t.String(), t.Null()]),
        summary: t.Union([t.String(), t.Null()]),
        description: t.Union([t.String(), t.Null()]),
      }),
    ),
  ),
});

export type ContentSearchDocument = Static<typeof ContentSearchDocumentSchema>;

// ANCHOR: Content Search Options

export const ContentSearchOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  type: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  postKind: t.Optional(t.Array(postKindLiterals)),
  tags: t.Optional(t.Array(TagRefSchema)),
  tagIds: t.Optional(t.Array(t.String())),
  realmId: t.Optional(t.String()),
  realmTagIds: t.Optional(t.Array(t.String())),
  languages: t.Optional(t.Array(t.String())),
  nsfw: t.Optional(t.Boolean()),
  isLicensed: t.Optional(t.Boolean()),
  textLength: t.Optional(
    t.Object({
      min: t.Optional(t.Number()),
      max: t.Optional(t.Number()),
    }),
  ),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("publishedAt"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type ContentSearchOptions = Static<typeof ContentSearchOptionsSchema>;

// ANCHOR: Content Search Result

export const ContentSearchResultSchema = t.Object({
  items: t.Array(ContentSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type ContentSearchResult = Static<typeof ContentSearchResultSchema>;

import type { Static } from "elysia";
import { t } from "elysia";
import { TagRefSchema } from "../common/tag-ref";
import { languageSchema } from "../language";
import { postKindLiterals } from "../post";
import { contentRatingSchema } from "../unit";

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

  // Searchable credit attribution (denormalized from Attribution -> Entity translations)
  creditNames: t.Array(t.String()),

  // Searchable subject attribution (denormalized from SubjectAttribution -> Entity translations)
  subjectNames: t.Array(t.String()),
  subjectEntityIds: t.Array(t.String()),
  subjectKinds: t.Array(t.String()),
  subjectRoles: t.Array(t.String()),

  // Searchable tag labels (denormalized from tag Unit translations)
  tagLabels: t.Array(t.String()),

  // Filterable: tag system (from UnitTag)
  tagIds: t.Array(t.String()),
  tagScores: t.Record(t.String(), t.Number()),

  // Filterable: realm system (from RealmUnit)
  realmIds: t.Array(t.String()),

  // Filterable: realm-tag system (from RealmTagApplication). Values are machine
  // filter keys formatted as "{realmUnitId}:{tagUnitId}", not display labels.
  realmTagKeys: t.Array(t.String()),

  // Filterable: shelf membership (only populated for type === "SHELF" documents)
  containedUnitIds: t.Optional(t.Array(t.String())),

  // Filterable: metadata
  languages: t.Array(t.String()),
  rating: contentRatingSchema,
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
  userId: t.Optional(t.String()),
  postKind: t.Optional(t.Array(postKindLiterals)),
  tags: t.Optional(t.Array(TagRefSchema)),
  tagIds: t.Optional(t.Array(t.String())),
  realmId: t.Optional(t.String()),
  realmTagIds: t.Optional(t.Array(t.String())),
  languages: t.Optional(t.Array(t.String())),
  ratings: t.Optional(t.Array(contentRatingSchema)),
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

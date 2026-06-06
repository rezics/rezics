import type { Static } from "elysia";
import { t } from "elysia";
import { languageSchema } from "../language";
import { readLanguageBodyBase } from "../list-query-base";

// ANCHOR: Post Search Document

export const PostSearchDocumentSchema = t.Object({
  id: t.String(),
  titleText: t.Optional(t.Union([t.String(), t.Null()])),
  contentText: t.Union([t.String(), t.Null()]),
  kind: t.Union([t.String(), t.Null()]),
  isLocked: t.Boolean(),
  replyCount: t.Number(),
  directReplyCount: t.Number(),
  lastReplyAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
  bestScore: t.Number(),
  hotScore: t.Number(),
  topScore: t.Number(),
  risingScore: t.Number(),
  controversyScore: t.Number(),
  trendingScore: t.Number(),
  qualityScore: t.Number(),
  rankUpdatedAt: t.Union([t.String(), t.Null()]),

  // Foreign keys (filterable)
  targetUnitId: t.Union([t.String(), t.Null()]),
  variantUnitId: t.Optional(t.Union([t.String(), t.Null()])),
  realmIds: t.Array(t.String()),
  authorUserId: t.String(),
  scoreEntryId: t.Union([t.String(), t.Null()]),

  // Denormalized author
  authorName: t.Union([t.String(), t.Null()]),
  authorSlug: t.Union([t.String(), t.Null()]),
  authorAvatar: t.Union([t.String(), t.Null()]),

  // Denormalized target unit
  targetTitles: t.Union([t.Array(t.String()), t.Null()]),
  targetType: t.Union([t.String(), t.Null()]),
  targetCoverUrl: t.Union([t.String(), t.Null()]),

  // Denormalized score
  scoreValue: t.Union([t.Number(), t.Null()]),
  scoreFields: t.Union([t.Record(t.String(), t.Number()), t.Null()]),

  // Extra
  extra: t.Optional(t.Any()),
  languages: t.Optional(t.Array(languageSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),
  supportLanguages: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        isPrimary: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
      }),
    ),
  ),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Union([t.String(), t.Null()]),
        content: t.Union([t.Any(), t.Null()]),
      }),
    ),
  ),
  resolvedLanguage: t.Optional(t.Union([languageSchema, t.Null()])),
  title: t.Optional(t.Union([t.String(), t.Null()])),
  content: t.Optional(t.Union([t.Any(), t.Null()])),
});

export type PostSearchDocument = Static<typeof PostSearchDocumentSchema>;

// ANCHOR: Post Search Options

export const PostSearchOptionsSchema = t.Object({
  ...readLanguageBodyBase.properties,
  keyword: t.Optional(t.String()),
  kind: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
  variantUnitId: t.Optional(t.String()),
  realmUnitId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  isLocked: t.Optional(t.Boolean()),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("replyCount"),
        t.Literal("bestScore"),
        t.Literal("hotScore"),
        t.Literal("topScore"),
        t.Literal("risingScore"),
        t.Literal("controversyScore"),
        t.Literal("trendingScore"),
        t.Literal("qualityScore"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type PostSearchOptions = Static<typeof PostSearchOptionsSchema>;

// ANCHOR: Post Search Result

export const PostSearchResultSchema = t.Object({
  items: t.Array(PostSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type PostSearchResult = Static<typeof PostSearchResultSchema>;

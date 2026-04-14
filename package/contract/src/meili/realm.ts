import { t } from "elysia";
import type { Static } from "elysia";
import { languageSchema } from "../language";

// ANCHOR: Realm Search Document

export const RealmSearchDocumentSchema = t.Object({
  id: t.String(),
  isPublic: t.Boolean(),
  isOfficial: t.Boolean(),
  memberCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
  userId: t.Union([t.String(), t.Null()]),

  // Searchable arrays (denormalized from UnitTranslation)
  titles: t.Array(t.String()),
  descriptions: t.Array(t.String()),

  // Structured translations for display rendering
  translations: t.Array(
    t.Object({
      language: languageSchema,
      title: t.Union([t.String(), t.Null()]),
      description: t.Union([t.String(), t.Null()]),
    }),
  ),

  // Extra
  extra: t.Optional(t.Any()),
});

export type RealmSearchDocument = Static<typeof RealmSearchDocumentSchema>;

// ANCHOR: Realm Search Options

export const RealmSearchOptionsSchema = t.Object({
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

export const RealmSearchResultSchema = t.Object({
  items: t.Array(RealmSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type RealmSearchResult = Static<typeof RealmSearchResultSchema>;

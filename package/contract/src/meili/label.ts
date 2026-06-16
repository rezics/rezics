import type { Static } from "elysia";
import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { readLanguageBodyBase } from "../list-query-base";

export const LabelSearchDocumentSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  slug: t.Union([t.String(), t.Null()]),
  status: t.String(),
  titles: t.Array(t.String()),
  aliasValues: t.Array(t.String()),
  languages: t.Array(contentLanguageSchema),
  isLanguageNeutral: t.Boolean(),
  supportLanguages: t.Array(
    t.Object({
      language: contentLanguageSchema,
      isPrimary: t.Optional(t.Boolean()),
      position: t.Optional(t.String()),
    }),
  ),
  translations: t.Array(
    t.Object({
      language: contentLanguageSchema,
      title: t.Union([t.String(), t.Null()]),
    }),
  ),
  createdAt: t.String(),
  updatedAt: t.String(),
  resolvedLanguage: t.Optional(t.Union([contentLanguageSchema, t.Null()])),
  title: t.Optional(t.Union([t.String(), t.Null()])),
});

export type LabelSearchDocument = Static<typeof LabelSearchDocumentSchema>;

export const LabelSearchOptionsSchema = t.Object({
  ...readLanguageBodyBase.properties,
  keyword: t.Optional(t.String()),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type LabelSearchOptions = Static<typeof LabelSearchOptionsSchema>;

export const LabelSearchResultSchema = t.Object({
  items: t.Array(LabelSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type LabelSearchResult = Static<typeof LabelSearchResultSchema>;

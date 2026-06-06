import type { Static } from "elysia";
import { t } from "elysia";
import { languageSchema } from "../language";
import { readLanguageBodyBase } from "../list-query-base";
import { pollResultVisibilitySchema, pollVoteModeSchema } from "../post/poll";

export const PollSearchDocumentSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  ownerUserId: t.Union([t.String(), t.Null()]),
  titles: t.Array(t.String()),
  descriptions: t.Array(t.String()),
  optionLabels: t.Array(t.String()),
  optionUnitIds: t.Array(t.String()),
  voteMode: pollVoteModeSchema,
  resultVisibility: pollResultVisibilitySchema,
  anonymous: t.Boolean(),
  closesAt: t.Union([t.String(), t.Null()]),
  closed: t.Boolean(),
  usageCount: t.Number(),
  used: t.Boolean(),
  languages: t.Array(languageSchema),
  isLanguageNeutral: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type PollSearchDocument = Static<typeof PollSearchDocumentSchema>;

export const PollSearchOptionsSchema = t.Object({
  ...readLanguageBodyBase.properties,
  keyword: t.Optional(t.String()),
  ownerUserId: t.Optional(t.String()),
  used: t.Optional(t.Boolean()),
  closed: t.Optional(t.Boolean()),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("usageCount"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type PollSearchOptions = Static<typeof PollSearchOptionsSchema>;

export const PollSearchResultSchema = t.Object({
  items: t.Array(PollSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type PollSearchResult = Static<typeof PollSearchResultSchema>;

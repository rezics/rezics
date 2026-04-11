import { t } from "elysia";

// ============================================================
// SEARCH CONTRACTS
// TODO(search-redesign): replaced by unified content index
// ============================================================

export const searchSortTypeSchema = t.Enum({
  relevance: "relevance",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
});

export const searchQueryOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  keywordFields: t.Optional(t.Array(t.String())),
  type: t.Optional(t.String()),
  types: t.Optional(t.Array(t.String())),
  tagUnitIds: t.Optional(t.Array(t.String())),
  language: t.Optional(t.String()),
  nsfw: t.Optional(t.Boolean()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(searchSortTypeSchema),
      order: t.Optional(t.Enum({ asc: "asc", desc: "desc" })),
    }),
  ),
  start: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type SearchQueryOptions = (typeof searchQueryOptionsSchema)["static"];

// Book-specific search (legacy compat stub)
export const bookQueryOptionsSchema = searchQueryOptionsSchema;
export type BookQueryOptions = SearchQueryOptions;

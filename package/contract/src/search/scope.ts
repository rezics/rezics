import type { Static } from "elysia";
import { t } from "elysia";

// ANCHOR: Search Scope
// Scope is route-derived; no client-mutable filter. The discriminator is `kind`.

export const SearchScopeSchema = t.Union([
  t.Object({ kind: t.Literal("global") }),
  t.Object({
    kind: t.Literal("book"),
    unitId: t.String(),
    workUnitId: t.Optional(t.String()),
    scopeMode: t.Optional(t.Union([t.Literal("exact"), t.Literal("work")])),
  }),
  t.Object({ kind: t.Literal("realm"), realmId: t.String() }),
  t.Object({ kind: t.Literal("user"), userId: t.String() }),
]);

export type SearchScope = Static<typeof SearchScopeSchema>;

// ANCHOR: Search Category
// Category is the result-view selector; user-mutable.

export const SearchCategorySchema = t.Union([
  t.Literal("all"),
  t.Literal("mixed"),
  t.Literal("books"),
  t.Literal("reviews"),
  t.Literal("excerpts"),
  t.Literal("remarks"),
  t.Literal("posts"),
  t.Literal("shelves"),
  t.Literal("realms"),
  t.Literal("users"),
  t.Literal("entities"),
]);

export type SearchCategory = Static<typeof SearchCategorySchema>;

export const DEFAULT_SEARCH_CATEGORY: SearchCategory = "all";

import type { Static } from "elysia";
import { t } from "elysia";

// ANCHOR: Search Scope
// Scope is route-derived; no client-mutable filter. The discriminator is `kind`.
// 作用域由路由派生；不提供客户端可变的过滤器。判别字段为 `kind`。

export const SearchScopeSchema = t.Union([
  t.Object({ kind: t.Literal("global") }),
  t.Object({
    kind: t.Literal("book"),
    unitId: t.String(),
  }),
  t.Object({ kind: t.Literal("realm"), realmId: t.String() }),
  t.Object({ kind: t.Literal("zone"), zoneUnitId: t.String() }),
  t.Object({ kind: t.Literal("user"), userId: t.String() }),
  t.Object({
    kind: t.Literal("saved"),
    shelfId: t.String(),
    userId: t.String(),
  }),
]);

export type SearchScope = Static<typeof SearchScopeSchema>;

// ANCHOR: Search Category
// Category is the result-view selector; user-mutable.
// 分类是结果视图选择器；用户可变更。

export const SearchCategorySchema = t.Union([
  t.Literal("all"),
  t.Literal("mixed"),
  t.Literal("books"),
  t.Literal("reviews"),
  t.Literal("excerpts"),
  t.Literal("remarks"),
  t.Literal("posts"),
  t.Literal("comments"),
  t.Literal("shelves"),
  t.Literal("realms"),
  t.Literal("zones"),
  t.Literal("users"),
  t.Literal("entities"),
]);

export type SearchCategory = Static<typeof SearchCategorySchema>;

export const DEFAULT_SEARCH_CATEGORY: SearchCategory = "all";

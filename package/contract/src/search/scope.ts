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

// The runtime list of every search category, derived from the schema so it
// can never drift out of sync with the union. Consumers (nav tabs, scope
// filters, route guards) import this instead of re-typing the literals — a
// hand-copied `SearchCategory[]` only rejects invalid members, it does not
// catch a missing one, so a new category would silently never appear.
// 每个搜索分类的运行时列表，从 schema 派生，因此永远不会与 union 漂移。
// 消费者（导航 tab、作用域过滤、路由守卫）导入它，而不再重抄字面量——手抄的
// `SearchCategory[]` 只拒绝非法成员、不会发现遗漏成员，于是新增分类会静默
// 不出现。
export const SEARCH_CATEGORIES: readonly SearchCategory[] =
  SearchCategorySchema.anyOf.map((literal) => literal.const);

export const DEFAULT_SEARCH_CATEGORY: SearchCategory = "all";

import {
  SEARCH_CATEGORIES,
  type SearchCategory,
  type SearchScope,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";

// Single source of truth from the contract — the scope filters below subtract
// from this, never re-list it.
// 单一事实来源来自契约——下方的作用域过滤只在此基础上做减法，绝不重列。
export const ALL_CATEGORIES = SEARCH_CATEGORIES;

export const CATEGORY_LABELS = {
  all: () => getI18nRuntime().i18n.t("search:category_all"),
  mixed: () => getI18nRuntime().i18n.t("search:category_mixed"),
  books: () => getI18nRuntime().i18n.t("search:category_books"),
  reviews: () => getI18nRuntime().i18n.t("search:category_reviews"),
  excerpts: () => getI18nRuntime().i18n.t("search:category_excerpts"),
  remarks: () => getI18nRuntime().i18n.t("search:category_remarks"),
  posts: () => getI18nRuntime().i18n.t("search:category_posts"),
  comments: () => getI18nRuntime().i18n.t("search:category_comments"),
  shelves: () => getI18nRuntime().i18n.t("search:category_shelves"),
  realms: () => getI18nRuntime().i18n.t("search:category_realms"),
  zones: () => getI18nRuntime().i18n.t("search:category_zones"),
  users: () => getI18nRuntime().i18n.t("search:category_users"),
  entities: () => getI18nRuntime().i18n.t("search:category_entities"),
} as const satisfies Record<SearchCategory, () => string>;

export function permittedCategoriesForScope(
  scope: SearchScope,
): readonly SearchCategory[] {
  switch (scope.kind) {
    case "global":
      return ALL_CATEGORIES;
    case "realm":
    case "zone":
      return ALL_CATEGORIES.filter(
        (c) =>
          c !== "realms" && c !== "zones" && c !== "users" && c !== "entities",
      );
    case "user":
      return ALL_CATEGORIES.filter((c) => c !== "users");
    case "book":
      return ALL_CATEGORIES.filter(
        (c) =>
          c !== "books" &&
          c !== "realms" &&
          c !== "zones" &&
          c !== "users" &&
          c !== "entities",
      );
    case "saved":
      return ["all", "shelves"];
  }
}

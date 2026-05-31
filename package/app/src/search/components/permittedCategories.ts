import { getI18nRuntime } from "@rezics/i18n/runtime";
import type { SearchCategory, SearchScope } from "@rezics/contract";
export const ALL_CATEGORIES: readonly SearchCategory[] = [
  "all",
  "mixed",
  "books",
  "reviews",
  "excerpts",
  "remarks",
  "posts",
  "comments",
  "shelves",
  "realms",
  "users",
  "entities",
];

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
      return ALL_CATEGORIES.filter(
        (c) => c !== "realms" && c !== "users" && c !== "entities",
      );
    case "user":
      return ALL_CATEGORIES.filter((c) => c !== "users");
    case "book":
      return ALL_CATEGORIES.filter(
        (c) =>
          c !== "books" && c !== "realms" && c !== "users" && c !== "entities",
      );
  }
}

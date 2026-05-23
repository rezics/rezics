import type { SearchCategory, SearchScope } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";

export const ALL_CATEGORIES: readonly SearchCategory[] = [
  "all",
  "mixed",
  "books",
  "reviews",
  "excerpts",
  "remarks",
  "posts",
  "shelves",
  "realms",
  "users",
  "entities",
];

export const CATEGORY_LABELS = {
  all: m.search_category_all,
  mixed: m.search_category_mixed,
  books: m.search_category_books,
  reviews: m.search_category_reviews,
  excerpts: m.search_category_excerpts,
  remarks: m.search_category_remarks,
  posts: m.search_category_posts,
  shelves: m.search_category_shelves,
  realms: m.search_category_realms,
  users: m.search_category_users,
  entities: m.search_category_entities,
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

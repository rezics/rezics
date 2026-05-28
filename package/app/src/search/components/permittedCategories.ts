import type { SearchCategory, SearchScope } from "@rezics/contract";
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
  all: search_category_all,
  mixed: search_category_mixed,
  books: search_category_books,
  reviews: search_category_reviews,
  excerpts: search_category_excerpts,
  remarks: search_category_remarks,
  posts: search_category_posts,
  shelves: search_category_shelves,
  realms: search_category_realms,
  users: search_category_users,
  entities: search_category_entities,
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

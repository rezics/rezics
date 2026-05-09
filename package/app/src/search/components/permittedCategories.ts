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
];

export const CATEGORY_LABELS: Record<SearchCategory, string> = {
  all: "All",
  mixed: "Mixed",
  books: "Books",
  reviews: "Reviews",
  excerpts: "Excerpts",
  remarks: "Remarks",
  posts: "Posts",
  shelves: "Shelves",
  realms: "Realms",
  users: "Users",
};

export function permittedCategoriesForScope(
  scope: SearchScope,
): readonly SearchCategory[] {
  switch (scope.kind) {
    case "global":
      return ALL_CATEGORIES;
    case "realm":
      return ALL_CATEGORIES.filter((c) => c !== "realms" && c !== "users");
    case "user":
      return ALL_CATEGORIES.filter((c) => c !== "users");
    case "book":
      return ALL_CATEGORIES.filter(
        (c) => c !== "books" && c !== "realms" && c !== "users",
      );
  }
}

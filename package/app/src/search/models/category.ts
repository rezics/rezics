import type { SearchCategory } from "@rezics/contract";

const SEARCH_CATEGORIES: SearchCategory[] = [
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

export function isSearchCategory(
  value: string | undefined,
): value is SearchCategory {
  return !!value && (SEARCH_CATEGORIES as string[]).includes(value);
}

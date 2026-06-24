import type { SearchCategory } from "@rezics/contract";

const SEARCH_CATEGORIES: SearchCategory[] = [
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
  "zones",
  "users",
  "entities",
];

export function isSearchCategory(
  value: string | undefined,
): value is SearchCategory {
  return !!value && (SEARCH_CATEGORIES as string[]).includes(value);
}

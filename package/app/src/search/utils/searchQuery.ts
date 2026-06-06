import type {
  SearchCategory,
  SearchQuery,
  SearchScope,
} from "@rezics/contract";
import { serializeSearchString } from "../models/searchQuery";

export type BuildSearchPathInput = SearchQuery & {
  scope?: SearchScope;
  category?: SearchCategory;
};

function scopeToBasePath(scope: SearchScope): string {
  switch (scope.kind) {
    case "global":
      return "/search";
    case "realm":
      return `/realm/${scope.realmId}/search`;
    case "user":
      return `/user/${scope.userId}/search`;
    case "book":
      return `/book/${scope.unitId}/search`;
    case "saved":
      return "/shelf/search";
  }
}

export function buildSearchPath(input: BuildSearchPathInput): string {
  const { scope = { kind: "global" }, category, ...query } = input;
  const base = scopeToBasePath(scope);
  const params = new URLSearchParams();
  const q = serializeSearchString(query);
  if (q) params.set("q", q);
  if (category && category !== "all") params.set("category", category);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

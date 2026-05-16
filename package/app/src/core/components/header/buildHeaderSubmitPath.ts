import { buildSearchPath } from "@/search/utils/searchQuery";
import { resolveScope } from "@/search/models/scope";

// Sibling of `unitHref` for the search URL surface: produces `/u/<slug>/search`
// when scope is a slug route and `/user/<unitId>/search` otherwise, matching
// the link-builder rule in `openspec/specs/public-short-routes/spec.md`.
export function buildHeaderSubmitPath(pathname: string, value: string): string {
  const scope = resolveScope(pathname);
  if (scope.kind === "userSlug") {
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    const qs = params.toString();
    return `/u/${scope.userSlug}/search${qs ? `?${qs}` : ""}`;
  }
  return buildSearchPath({ scope, keyword: value });
}

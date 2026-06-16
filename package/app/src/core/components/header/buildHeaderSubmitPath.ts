import { resolveScope } from "@/search/models/scope";
import { buildSearchPath } from "@/search/utils/searchQuery";

// Sibling of `unitHref` for the search URL surface: produces `/u/<slug>/search`
// when scope is a slug route (short slug-prefix) and `/user/<unitId>/search`
// otherwise (long unitId-prefix fallback).
// 用于搜索 URL 层面的 `unitHref` 同类函数：当 scope 为 slug 路由（短 slug 前缀）时
// 生成 `/u/<slug>/search`，否则生成 `/user/<unitId>/search`（长 unitId 前缀回退）。
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

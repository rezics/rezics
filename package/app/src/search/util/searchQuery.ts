import type { SearchInfo } from "../model/searchInfo";
import { normalizeSearchInfo } from "../model/searchInfo";

export function buildSearchPath(value: SearchInfo): string {
  const normalized = normalizeSearchInfo(value);
  const params = new URLSearchParams();

  if (normalized.keyword) {
    params.set("keyword", normalized.keyword);
  }
  if (normalized.tags?.length) {
    params.set("tags", normalized.tags.join(","));
  }
  if (normalized.tagIds?.length) {
    params.set("tagIds", normalized.tagIds.join(","));
  }
  if (normalized.type) {
    const types = Array.isArray(normalized.type)
      ? normalized.type.join(",")
      : normalized.type;
    params.set("type", types);
  }
  if (normalized.realmId) {
    params.set("realmId", normalized.realmId);
  }
  if (normalized.nsfw) {
    params.set("nsfw", "true");
  }
  if (normalized.isLicensed) {
    params.set("isLicensed", "true");
  }

  const query = params.toString();
  return query.length > 0 ? `/search?${query}` : "/search";
}

export function parseSearchParams(search: string): SearchInfo {
  const p = new URLSearchParams(search);
  const typeParam = p.get("type");
  return {
    keyword: p.get("keyword") ?? "",
    tags: p.get("tags")?.split(",").filter(Boolean) ?? [],
    tagIds: p.get("tagIds")?.split(",").filter(Boolean) ?? [],
    type: typeParam?.includes(",") ? typeParam.split(",") : typeParam ?? undefined,
    realmId: p.get("realmId") ?? undefined,
    nsfw: p.get("nsfw") === "true",
    isLicensed: p.get("isLicensed") === "true",
  };
}

/** @deprecated Use buildSearchPath */
export const buildBookSearchPath = buildSearchPath;
/** @deprecated Use parseSearchParams */
export const parseBookSearchParams = parseSearchParams;

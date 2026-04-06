import type { SearchInfo } from "../model/searchInfo";
import { normalizeSearchInfo } from "../model/searchInfo";

export function buildBookSearchPath(value: SearchInfo): string {
  const normalized = normalizeSearchInfo(value);
  const params = new URLSearchParams();

  if (normalized.keyword) {
    params.set("keyword", normalized.keyword);
  }
  if (normalized.tags?.length) {
    params.set("tags", normalized.tags.join(","));
  }
  if (normalized.nsfw) {
    params.set("nsfw", "true");
  }
  if (normalized.isLicensed) {
    params.set("isLicensed", "true");
  }
  if (normalized.textLength) {
    params.set("textLength", normalized.textLength);
  }

  const query = params.toString();
  return query.length > 0 ? `/book?${query}` : "/book";
}

export function parseBookSearchParams(search: string): SearchInfo {
  const searchParams = new URLSearchParams(search);
  return {
    keyword: searchParams.get("keyword") ?? "",
    tags: searchParams.get("tags")?.split(",").filter(Boolean) ?? [],
    nsfw: searchParams.get("nsfw") === "true",
    isLicensed: searchParams.get("isLicensed") === "true",
    textLength: searchParams.get("textLength") ?? "",
  };
}

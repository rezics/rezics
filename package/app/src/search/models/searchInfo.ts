import type { ContentSearchOptions } from "@rezics/contract";

export interface SearchInfo {
  keyword?: string;
  tags?: string[];
  tagIds?: string[];
  type?: string | string[];
  realmId?: string;
  realmTagIds?: string[];
  nsfw?: boolean;
  isLicensed?: boolean;
  // Legacy fields kept for URL compat
  textLength?: string;
  user?: string;
}

export function normalizeKeyword(value?: string): string {
  return (value ?? "").trim();
}

export function normalizeTags(tags?: string[]): string[] {
  return (tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

export function normalizeSearchInfo(value: SearchInfo): SearchInfo {
  return {
    ...value,
    keyword: normalizeKeyword(value.keyword),
    tags: normalizeTags(value.tags),
  };
}

/**
 * Resolve title from a ContentSearchDocument's titles array
 * based on user's preferred language, falling back to first available.
 */
export function resolveTitle(
  titles: string[],
  languages: string[],
  preferredLanguage?: string,
): string {
  if (!titles.length) return "";
  if (preferredLanguage) {
    const idx = languages.indexOf(preferredLanguage);
    if (idx >= 0 && titles[idx]) return titles[idx];
  }
  return titles[0] ?? "";
}

/**
 * Convert SearchInfo to ContentSearchOptions for the API.
 */
export function toContentSearchOptions(info: SearchInfo): ContentSearchOptions {
  return {
    keyword: info.keyword || undefined,
    type: info.type,
    tagIds: info.tagIds?.length ? info.tagIds : undefined,
    realmId: info.realmId,
    realmTagIds: info.realmTagIds?.length ? info.realmTagIds : undefined,
    nsfw: info.nsfw ?? false,
    isLicensed: info.isLicensed,
  };
}

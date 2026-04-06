export interface SearchInfo {
  keyword?: string;
  tags?: string[];
  textLength?: string;
  user?: string;
  nsfw?: boolean;
  isLicensed?: boolean;
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

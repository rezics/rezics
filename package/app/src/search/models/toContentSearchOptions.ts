import type { ContentSearchOptions, SearchQuery } from "@rezics/contract";

const VALID_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "publishedAt",
  "relevance",
] as const;

type SortField = (typeof VALID_SORT_FIELDS)[number];

export function toContentSearchOptions(
  query: SearchQuery,
): ContentSearchOptions {
  const opts: ContentSearchOptions = {};

  if (query.keyword) {
    opts.keyword = query.keyword;
  }

  if (query.type?.length) {
    opts.type = query.type;
  }

  if (query.postKind?.length) {
    opts.postKind = query.postKind;
  }

  if (query.tags?.length) {
    opts.tags = query.tags;
  }

  if (query.realm?.slug) {
    opts.realmId = query.realm.unitId ?? query.realm.slug;
  }

  if (query.languages?.length) {
    opts.languages = [...new Set(query.languages)];
  }

  opts.nsfw = query.nsfw ?? false;

  if (query.isLicensed !== undefined) {
    opts.isLicensed = query.isLicensed;
  }

  if (query.textLength) {
    const { min, max } = query.textLength;
    if (typeof min === "number" || typeof max === "number") {
      opts.textLength = {
        ...(typeof min === "number" ? { min } : {}),
        ...(typeof max === "number" ? { max } : {}),
      };
    }
  }

  if (query.sort) {
    const field = (VALID_SORT_FIELDS as readonly string[]).includes(query.sort)
      ? (query.sort as SortField)
      : "relevance";
    opts.sort = { field };
  }

  return opts;
}

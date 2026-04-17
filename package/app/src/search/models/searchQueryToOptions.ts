import type {
  ContentSearchOptions,
  SearchQuery,
  ZoneFilters,
} from "@rezics/contract";

/**
 * Convert a SearchQuery into ContentSearchOptions for the API.
 * Optionally merges with pre-applied zone filters.
 *
 * User filters override zone filters where both are specified.
 */
export function searchQueryToOptions(
  query: SearchQuery,
  preApplied?: ZoneFilters,
): ContentSearchOptions {
  const opts: ContentSearchOptions = {};

  // Type: user query overrides pre-applied
  const type = query.type?.length ? query.type : preApplied?.type;
  if (type) {
    opts.type = type;
  }

  // Tags: merge user + pre-applied
  const userTags = query.tags ?? [];
  const preAppliedTags = preApplied?.tags ?? [];
  const allTags = [...preAppliedTags, ...userTags];
  if (allTags.length > 0) {
    opts.tags = allTags;
  }

  // Realm: user query overrides pre-applied
  if (query.realm?.slug) {
    // User specified a realm via search syntax — send as realmId
    // The slug needs resolution, but since we don't have unitId here,
    // we'll use the slug as-is (backend should handle SlugRef for realms in future)
    opts.realmId = query.realm.unitId ?? query.realm.slug;
  } else if (preApplied?.realmId) {
    opts.realmId = preApplied.realmId;
  }

  // Languages: merge user + pre-applied
  const languages = [
    ...(preApplied?.languages ?? []),
    ...(query.languages ?? []),
  ];
  if (languages.length > 0) {
    opts.languages = [...new Set(languages)];
  }

  // NSFW: user query overrides pre-applied
  opts.nsfw = query.nsfw ?? preApplied?.nsfw ?? false;

  // Licensed: user query overrides pre-applied
  if (query.isLicensed !== undefined) {
    opts.isLicensed = query.isLicensed;
  } else if (preApplied?.isLicensed !== undefined) {
    opts.isLicensed = preApplied.isLicensed;
  }

  // Keyword
  if (query.keyword) {
    opts.keyword = query.keyword;
  }

  // Sort
  if (query.sort) {
    const validFields = [
      "createdAt",
      "updatedAt",
      "publishedAt",
      "relevance",
    ] as const;
    const field = validFields.find((f) => f === query.sort) ?? "relevance";
    opts.sort = { field };
  }

  return opts;
}

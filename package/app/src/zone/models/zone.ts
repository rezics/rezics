import type {
  ContentSearchOptions,
  ZoneDTO,
  ZoneFilters,
} from "@rezics/contract";

export type { ZoneDTO, ZoneFilters };

/**
 * Merge zone base filters with user-provided overrides.
 * User overrides take precedence where specified.
 */
export function mergeZoneFilters(
  base: ZoneFilters,
  user: Partial<ContentSearchOptions>,
): ContentSearchOptions {
  return {
    type: user.type ?? base.type,
    tags: [...(base.tags ?? []), ...(user.tags ?? [])],
    realmId: user.realmId ?? base.realmId,
    languages: [
      ...new Set([...(base.languages ?? []), ...(user.languages ?? [])]),
    ],
    ratings: user.ratings ?? base.ratings,
    isLicensed:
      user.isLicensed !== undefined ? user.isLicensed : base.isLicensed,
    keyword: user.keyword,
    sort: user.sort,
    offset: user.offset,
    limit: user.limit,
  };
}

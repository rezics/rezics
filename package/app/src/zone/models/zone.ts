import type {
  ContentSearchOptions,
  Language,
  ZoneDTO,
  ZoneFilters,
} from "@rezics/contract";
import { normalizeLanguage } from "@rezics/contract";

export type { ZoneDTO, ZoneFilters };

/**
 * Merge zone base filters with user-provided overrides.
 * User overrides take precedence where specified.
 */
export function mergeZoneFilters(
  base: ZoneFilters,
  user: Partial<ContentSearchOptions>,
): ContentSearchOptions {
  const languages: Language[] = [
    ...new Set(
      [...(base.languages ?? []), ...(user.languages ?? [])]
        .map((language) => normalizeLanguage(language))
        .filter((language): language is Language => !!language),
    ),
  ];

  return {
    type: user.type ?? base.type,
    tags: [...(base.tags ?? []), ...(user.tags ?? [])],
    realmId: user.realmId ?? base.realmId,
    languages,
    ratings: user.ratings ?? base.ratings,
    isLicensed:
      user.isLicensed !== undefined ? user.isLicensed : base.isLicensed,
    keyword: user.keyword,
    sort: user.sort,
    offset: user.offset,
    limit: user.limit,
  };
}

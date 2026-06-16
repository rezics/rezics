import type {
  ContentRating,
  ContentSearchOptions,
  Language,
  SearchQuery,
  ZoneDTO,
  ZoneFilters,
} from "@rezics/contract";
import { normalizeLanguage } from "@rezics/contract";

export type { ZoneDTO, ZoneFilters };

/**
 * Merge zone base filters with user-provided filters without allowing the user
 * filter to remove the zone boundary.
 */
export function mergeZoneFilters(
  base: ZoneFilters,
  user: Partial<ContentSearchOptions>,
): ContentSearchOptions {
  const baseTypes = normalizeStringList(base.type);
  const userTypes = normalizeStringList(user.type);
  const type =
    baseTypes.length > 0
      ? intersectOrBase(baseTypes, userTypes)
      : normalizeTypeOutput(user.type);

  const languages = mergeBoundaryLanguages(base.languages, user.languages);
  const ratings = mergeBoundaryRatings(base.ratings, user.ratings);
  const realmId = base.realmUnitId ?? base.realmId ?? user.realmId;
  const tags = [...(base.tags ?? []), ...(user.tags ?? [])];

  return {
    ...(type !== undefined ? { type } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(realmId ? { realmId } : {}),
    ...(languages.length > 0 ? { languages } : {}),
    ...(ratings.length > 0 ? { ratings } : {}),
    isLicensed:
      base.isLicensed !== undefined ? base.isLicensed : user.isLicensed,
    keyword: user.keyword,
    sort: user.sort,
    offset: user.offset,
    limit: user.limit,
  };
}

export function zoneFiltersToSearchQuery(
  filters: ZoneFilters | null | undefined,
  allowedRatings: ContentRating[] = [],
): SearchQuery {
  const query: SearchQuery = {};
  if (!filters) {
    if (allowedRatings.length > 0) query.ratings = allowedRatings;
    return query;
  }

  const types = normalizeStringList(filters.type);
  if (types.length > 0) query.type = types;
  if (filters.tags?.length) query.tags = filters.tags;
  if (filters.realmUnitId || filters.realmId) {
    query.realm = {
      scope: "realm",
      slug: filters.realmId ?? filters.realmUnitId ?? "",
      unitId: filters.realmUnitId ?? filters.realmId,
    };
  }
  const languages = normalizeLanguages(filters.languages);
  if (languages.length > 0) query.languages = languages;
  const ratings = mergeBoundaryRatings(filters.ratings, allowedRatings);
  if (ratings.length > 0) query.ratings = ratings;
  if (filters.postKind?.length) query.postKind = filters.postKind;
  if (filters.isLicensed !== undefined) query.isLicensed = filters.isLicensed;
  return query;
}

function normalizeStringList(
  value: string | string[] | null | undefined,
): string[] {
  if (!value) return [];
  return [...new Set(Array.isArray(value) ? value : [value])].filter(Boolean);
}

function normalizeTypeOutput(
  value: ContentSearchOptions["type"],
): ContentSearchOptions["type"] | undefined {
  const list = normalizeStringList(value);
  if (list.length === 0) return undefined;
  return Array.isArray(value) ? list : list[0];
}

function normalizeLanguages(
  value: readonly (string | null | undefined)[] | null | undefined,
): Language[] {
  return [
    ...new Set(
      (value ?? [])
        .map((language) => normalizeLanguage(language))
        .filter((language): language is Language => !!language),
    ),
  ];
}

function intersectOrBase<T>(base: T[], user: T[]): T[] {
  if (user.length === 0) return base;
  const userSet = new Set(user);
  const intersection = base.filter((item) => userSet.has(item));
  return intersection.length > 0 ? intersection : base;
}

function mergeBoundaryLanguages(
  base: readonly (string | null | undefined)[] | null | undefined,
  user: readonly (string | null | undefined)[] | null | undefined,
): Language[] {
  const baseLanguages = normalizeLanguages(base);
  const userLanguages = normalizeLanguages(user);
  if (baseLanguages.length === 0) return userLanguages;
  return intersectOrBase(baseLanguages, userLanguages);
}

function mergeBoundaryRatings(
  base: ContentRating[] | undefined,
  user: ContentRating[] | undefined,
): ContentRating[] {
  if (!base?.length) return user ?? [];
  return intersectOrBase(base, user ?? []);
}

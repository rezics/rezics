import type { ContentRating, SearchQuery, SlugRef } from "@rezics/contract";

const RATING_VALUES: readonly ContentRating[] = [
  "GENERAL",
  "R_15",
  "R_18",
  "R_18G",
];

function parseRatings(raw: string | null): ContentRating[] {
  if (!raw) return [];
  const set = new Set(RATING_VALUES);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ContentRating => set.has(s as ContentRating));
}

function parseTags(raw: string | null): SlugRef[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((slug) => ({ slug }));
}

function parseArray(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildSearchPath(query: SearchQuery, base = "/search"): string {
  const params = new URLSearchParams();

  if (query.keyword?.trim()) {
    params.set("keyword", query.keyword.trim());
  }
  if (query.tags?.length) {
    params.set("tags", query.tags.map((t) => t.slug).join(","));
  }
  if (query.type?.length) {
    params.set("type", query.type.join(","));
  }
  if (query.postKind?.length) {
    params.set("postKind", query.postKind.join(","));
  }
  if (query.languages?.length) {
    params.set("lang", query.languages.join(","));
  }
  if (query.realm?.slug) {
    params.set("in", query.realm.slug);
  }
  if (query.ratings?.length) {
    params.set("ratings", query.ratings.join(","));
  }
  if (query.isLicensed !== undefined) {
    params.set("isLicensed", String(query.isLicensed));
  }
  if (query.textLength) {
    if (typeof query.textLength.min === "number") {
      params.set("minLength", String(query.textLength.min));
    }
    if (typeof query.textLength.max === "number") {
      params.set("maxLength", String(query.textLength.max));
    }
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }

  const qs = params.toString();
  return qs.length > 0 ? `${base}?${qs}` : base;
}

export function parseSearchParams(search: string): SearchQuery {
  const p = new URLSearchParams(search);
  const query: SearchQuery = {};

  const keyword = p.get("keyword")?.trim();
  if (keyword) query.keyword = keyword;

  const tags = parseTags(p.get("tags"));
  if (tags.length) query.tags = tags;

  const type = parseArray(p.get("type"));
  if (type.length) query.type = type;

  const postKind = parseArray(p.get("postKind"));
  if (postKind.length) query.postKind = postKind as SearchQuery["postKind"];

  const languages = parseArray(p.get("lang"));
  if (languages.length) query.languages = languages;

  const realmSlug = p.get("in");
  if (realmSlug) query.realm = { slug: realmSlug };

  const ratings = parseRatings(p.get("ratings"));
  if (ratings.length) query.ratings = ratings;

  const isLicensed = p.get("isLicensed");
  if (isLicensed === "true") query.isLicensed = true;
  else if (isLicensed === "false") query.isLicensed = false;

  const minLength = p.get("minLength");
  const maxLength = p.get("maxLength");
  if (minLength || maxLength) {
    query.textLength = {
      ...(minLength ? { min: Number(minLength) } : {}),
      ...(maxLength ? { max: Number(maxLength) } : {}),
    };
  }

  const sort = p.get("sort");
  if (sort) query.sort = sort;

  return query;
}

export const buildBookSearchPath = buildSearchPath;

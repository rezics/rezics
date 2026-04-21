import type { ContentRating, SearchQuery } from "@rezics/contract";

const RATING_TOKENS: Record<string, ContentRating> = {
  general: "GENERAL",
  g: "GENERAL",
  r15: "R_15",
  r_15: "R_15",
  "r-15": "R_15",
  r18: "R_18",
  r_18: "R_18",
  "r-18": "R_18",
  r18g: "R_18G",
  r_18g: "R_18G",
  "r-18g": "R_18G",
};

const TAG_REGEX = /\[([^\]]+)\]/g;
const FILTER_REGEX = /(\w+):("[^"]*"|\S+)/g;

/**
 * Parse a StackOverflow-style search string into a structured SearchQuery.
 *
 * Supported tokens:
 *   [slug]          → tag filter
 *   type:value      → content type
 *   lang:value      → language
 *   rating:tier     → rating tier (GENERAL, R_15, R_18, R_18G; repeatable)
 *   licensed:yes|no → licensed toggle
 *   in:slug         → realm scope
 *   sort:value      → sort order
 *   everything else → keyword
 */
export function parseSearchString(input: string): SearchQuery {
  if (!input.trim()) return {};

  const result: SearchQuery = {};
  let remaining = input;

  // Extract [tag] tokens
  const tagMatches = [...input.matchAll(TAG_REGEX)];
  if (tagMatches.length > 0) {
    result.tags = tagMatches
      .map((m) => m[1]!)
      .filter(Boolean)
      .map((slug) => ({ slug }));
    for (const m of tagMatches) {
      remaining = remaining.replace(m[0], "");
    }
  }

  // Extract key:value tokens
  const filterMatches = [...remaining.matchAll(FILTER_REGEX)];
  for (const m of filterMatches) {
    const key = m[1]!.toLowerCase();
    const rawValue = m[2]!.replace(/^"|"$/g, "");

    switch (key) {
      case "type":
        result.type = [...(result.type ?? []), rawValue];
        break;
      case "lang":
        result.languages = [...(result.languages ?? []), rawValue];
        break;
      case "rating": {
        const tier = RATING_TOKENS[rawValue.toLowerCase()];
        if (tier) {
          result.ratings = [...(result.ratings ?? []), tier];
        }
        break;
      }
      case "licensed":
        result.isLicensed = rawValue === "yes" || rawValue === "true";
        break;
      case "in":
        result.realm = { slug: rawValue };
        break;
      case "sort":
        result.sort = rawValue;
        break;
    }

    remaining = remaining.replace(m[0], "");
  }

  // Remaining text is the keyword
  const keyword = remaining.trim();
  if (keyword) {
    result.keyword = keyword;
  }

  return result;
}

/**
 * Serialize a structured SearchQuery back into the SO-style syntax string.
 */
export function serializeSearchString(query: SearchQuery): string {
  const parts: string[] = [];

  if (query.tags?.length) {
    for (const tag of query.tags) {
      parts.push(`[${tag.slug}]`);
    }
  }

  if (query.type?.length) {
    for (const t of query.type) {
      parts.push(`type:${t}`);
    }
  }

  if (query.languages?.length) {
    for (const lang of query.languages) {
      parts.push(`lang:${lang}`);
    }
  }

  if (query.ratings?.length) {
    for (const tier of query.ratings) {
      parts.push(`rating:${tier}`);
    }
  }

  if (query.isLicensed !== undefined) {
    parts.push(`licensed:${query.isLicensed ? "yes" : "no"}`);
  }

  if (query.realm) {
    parts.push(`in:${query.realm.slug}`);
  }

  if (query.sort) {
    parts.push(`sort:${query.sort}`);
  }

  if (query.keyword) {
    parts.push(query.keyword);
  }

  return parts.join(" ");
}

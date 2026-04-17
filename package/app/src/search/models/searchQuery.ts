import type { SearchQuery } from "@rezics/contract";

const TAG_REGEX = /\[([^\]]+)\]/g;
const FILTER_REGEX = /(\w+):("[^"]*"|\S+)/g;

/**
 * Parse a StackOverflow-style search string into a structured SearchQuery.
 *
 * Supported tokens:
 *   [slug]          → tag filter
 *   type:value      → content type
 *   lang:value      → language
 *   nsfw:yes|no     → NSFW toggle
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
      case "nsfw":
        result.nsfw = rawValue === "yes" || rawValue === "true";
        break;
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

  if (query.nsfw !== undefined) {
    parts.push(`nsfw:${query.nsfw ? "yes" : "no"}`);
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

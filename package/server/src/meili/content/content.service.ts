import type {
  ContentSearchOptions,
  ContentSearchResult,
} from "@rezics/contract";
import { searchClient } from "../search-client";

/**
 * Search the unified content index with typed options.
 */
export async function searchContent(
  opts: ContentSearchOptions,
): Promise<ContentSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = [];

  // Type filter
  if (opts.type) {
    const types = Array.isArray(opts.type) ? opts.type : [opts.type];
    if (types.length === 1) {
      filter.push(`type = "${types[0]}"`);
    } else if (types.length > 1) {
      filter.push(
        `type IN [${types.map((t) => `"${t}"`).join(", ")}]`,
      );
    }
  }

  // Global tag filter
  if (opts.tagIds?.length) {
    for (const tagId of opts.tagIds) {
      filter.push(`tagIds = "${tagId}"`);
    }
  }

  // Realm filter
  if (opts.realmId) {
    filter.push(`realmIds = "${opts.realmId}"`);
  }

  // Realm-scoped tag filter (build compound keys)
  if (opts.realmId && opts.realmTagIds?.length) {
    const realmTagFilters = opts.realmTagIds.map(
      (tagId) => `realmTagKeys = "${opts.realmId}:${tagId}"`,
    );
    if (realmTagFilters.length === 1) {
      filter.push(realmTagFilters[0]!);
    } else {
      filter.push(`(${realmTagFilters.join(" OR ")})`);
    }
  }

  // Language filter
  if (opts.languages?.length) {
    for (const lang of opts.languages) {
      filter.push(`languages = "${lang}"`);
    }
  }

  // NSFW filter (default: exclude nsfw)
  if (opts.nsfw === true) {
    filter.push("nsfw = true");
  } else {
    filter.push("nsfw = false");
  }

  // Licensed filter
  if (opts.isLicensed === true) {
    filter.push("isLicensed = true");
  } else if (opts.isLicensed === false) {
    filter.push("isLicensed = false");
  }

  // Visibility: always public for content search
  filter.push('visibility = "PUBLIC"');

  // Sort
  const sort: string[] = [];
  if (opts.sort?.field && opts.sort.field !== "relevance") {
    const order = opts.sort.order ?? "desc";
    sort.push(`${opts.sort.field}:${order}`);
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const resp = await searchClient.contentIndex.search(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    items: resp.hits as any[],
    total: resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

import type { PostSearchOptions, PostSearchResult } from "@rezics/contract";
import { searchClient } from "../search-client";
import { buildPreferredLanguageFilter } from "../search/filters";
import { resolvePostHitDisplay } from "../search/read-language";

export async function searchPosts(
  opts: PostSearchOptions,
): Promise<PostSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = [];

  if (opts.kind) {
    filter.push(`kind = "${opts.kind}"`);
  }
  if (opts.targetUnitId) {
    filter.push(`targetUnitId = "${opts.targetUnitId}"`);
  }
  if (opts.variantUnitId) {
    filter.push(`variantUnitId = "${opts.variantUnitId}"`);
  }
  if (opts.realmUnitId) {
    filter.push(`realmIds = "${opts.realmUnitId}"`);
  }
  if (opts.authorUserId) {
    filter.push(`authorUserId = "${opts.authorUserId}"`);
  }
  if (typeof opts.isLocked === "boolean") {
    filter.push(`isLocked = ${opts.isLocked}`);
  }
  const languageFilter = buildPreferredLanguageFilter(opts);
  if (languageFilter) {
    filter.push(languageFilter);
  }

  const sort: string[] = [];
  if (opts.sort?.field && opts.sort.field !== "relevance") {
    const order = opts.sort.order ?? "desc";
    sort.push(`${opts.sort.field}:${order}`);
  } else if (!q) {
    sort.push("createdAt:desc");
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const resp = await searchClient.postIndex.search(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    items: (resp.hits as any[]).map((hit) => resolvePostHitDisplay(hit, opts)),
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

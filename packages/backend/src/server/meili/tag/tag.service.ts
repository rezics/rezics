import type { TagSearchOptions, TagSearchResult } from "@rezics/contract";
import { resolveTagHitDisplay } from "../search/read-language";
import { searchClient } from "../search-client";

export async function searchTags(
  opts: TagSearchOptions,
): Promise<TagSearchResult> {
  const q = opts.keyword ?? "";
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const offset = Math.max(0, opts.offset ?? 0);

  const resp = await searchClient.tagIndex.search(q, {
    offset,
    limit,
    filter: ['status = "PUBLISHED"'],
    sort: q ? undefined : ["updatedAt:desc"],
  });

  return {
    items: (resp.hits as any[]).map((hit) => resolveTagHitDisplay(hit, opts)),
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

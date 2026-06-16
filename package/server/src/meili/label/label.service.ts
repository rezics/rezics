import type { LabelSearchOptions, LabelSearchResult } from "@rezics/contract";
import { resolveLabelHitDisplay } from "../search/read-language";
import { searchClient } from "../search-client";

export async function searchLabels(
  opts: LabelSearchOptions,
): Promise<LabelSearchResult> {
  const q = opts.keyword ?? "";
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const offset = Math.max(0, opts.offset ?? 0);

  const resp = await searchClient.labelIndex.search(q, {
    offset,
    limit,
    filter: ['status = "PUBLISHED"'],
    sort: q ? undefined : ["updatedAt:desc"],
  });

  return {
    items: (resp.hits as any[]).map((hit) => resolveLabelHitDisplay(hit, opts)),
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

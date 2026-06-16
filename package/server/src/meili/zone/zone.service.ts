import type { ZoneSearchOptions, ZoneSearchResult } from "@rezics/contract";
import { buildPreferredLanguageFilter } from "../search/filters";
import { resolveZoneHitDisplay } from "../search/read-language";
import { searchClient } from "../search-client";

export async function searchZones(
  opts: ZoneSearchOptions,
): Promise<ZoneSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = ['visibility = "PUBLIC"'];

  if (opts.ownerRealmUnitId) {
    filter.push(`ownerRealmUnitId = "${opts.ownerRealmUnitId}"`);
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
    sort.push("updatedAt:desc");
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const resp = await searchClient.zoneIndex.search(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    items: (resp.hits as any[]).map((hit) => resolveZoneHitDisplay(hit, opts)),
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

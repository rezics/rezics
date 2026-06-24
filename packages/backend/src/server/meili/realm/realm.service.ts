import type { RealmSearchOptions, RealmSearchResult } from "@rezics/contract";
import { resolveRealmHitDisplay } from "../search/read-language";
import { searchClient } from "../search-client";

export async function searchRealms(
  opts: RealmSearchOptions,
): Promise<RealmSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = [];

  if (typeof opts.isPublic === "boolean") {
    filter.push(`isPublic = ${opts.isPublic}`);
  }
  if (typeof opts.isOfficial === "boolean") {
    filter.push(`isOfficial = ${opts.isOfficial}`);
  }
  const sort: string[] = [];
  if (opts.sort?.field && opts.sort.field !== "relevance") {
    const order = opts.sort.order ?? "desc";
    sort.push(`${opts.sort.field}:${order}`);
  } else if (!q) {
    sort.push("memberCount:desc");
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const resp = await searchClient.realmIndex.search(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    items: (resp.hits as any[]).map((hit) => resolveRealmHitDisplay(hit, opts)),
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

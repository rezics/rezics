import type { PollSearchOptions, PollSearchResult } from "@rezics/contract";
import { searchClient } from "../search-client";

export async function searchPolls(
  opts: PollSearchOptions,
): Promise<PollSearchResult> {
  const q = opts.keyword ?? "";
  const filter: string[] = [];

  if (opts.ownerUserId) {
    filter.push(`ownerUserId = "${opts.ownerUserId}"`);
  }
  if (typeof opts.used === "boolean") {
    filter.push(`used = ${opts.used}`);
  }
  if (typeof opts.closed === "boolean") {
    filter.push(`closed = ${opts.closed}`);
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

  const resp = await searchClient.pollIndex.search(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    items: resp.hits as any[],
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

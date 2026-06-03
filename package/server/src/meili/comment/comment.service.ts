import type {
  CommentSearchOptions,
  CommentSearchResult,
} from "@rezics/contract";
import { searchClient } from "../search-client";

export function buildCommentSearchFilter(opts: CommentSearchOptions): string[] {
  const filter: string[] = [];

  if (opts.rootUnitId) {
    filter.push(`rootUnitId = "${opts.rootUnitId}"`);
  }
  if (opts.realmUnitId) {
    filter.push(`realmUnitId = "${opts.realmUnitId}"`);
  }
  if (opts.parentCommentId) {
    filter.push(`parentCommentId = "${opts.parentCommentId}"`);
  }
  if (opts.authorUserId) {
    filter.push(`authorUserId = "${opts.authorUserId}"`);
  }
  if (typeof opts.depth === "number") {
    filter.push(`depth = ${opts.depth}`);
  }
  if (typeof opts.isLocked === "boolean") {
    filter.push(`isLocked = ${opts.isLocked}`);
  }
  if (opts.state) {
    filter.push(`state = "${opts.state}"`);
  }

  return filter;
}

export async function searchComments(
  opts: CommentSearchOptions,
): Promise<CommentSearchResult> {
  const q = opts.keyword ?? "";
  const filter = buildCommentSearchFilter(opts);
  const sort: string[] = [];

  if (opts.sort?.field && opts.sort.field !== "relevance") {
    const order = opts.sort.order ?? "desc";
    sort.push(`${opts.sort.field}:${order}`);
  } else if (!q) {
    sort.push("createdAt:desc");
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const resp = await searchClient.commentIndex.search(q, {
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

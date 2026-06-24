import type {
  CommentSearchOptions,
  CommentSearchResult,
  CommentSortMode,
} from "@rezics/contract";
import { searchClient } from "../search-client";

export function commentSliceSort(sort: CommentSortMode = "best"): string {
  // Future CommentRankServing table swaps in here if Meili consistency or
  // cursor stability stops being sufficient for ranked comment slices.
  // 如果 Meili 的一致性或游标稳定性不再满足排序评论切片的需求，未来的
  // CommentRankServing 表将在此处替换接入。
  switch (sort) {
    case "best":
      return "bestScore:desc";
    case "top":
      return "topScore:desc";
    case "rising":
      return "risingScore:desc";
    case "controversial":
      return "controversyScore:desc";
    case "old":
      return "createdAt:asc";
    case "new":
      return "createdAt:desc";
  }
}

export function buildCommentSearchFilter(opts: CommentSearchOptions): string[] {
  const filter: string[] = [];

  if (opts.rootUnitId) {
    filter.push(`rootUnitId = "${opts.rootUnitId}"`);
  }
  if (opts.realmUnitId !== undefined) {
    filter.push(
      opts.realmUnitId === null
        ? "realmUnitId IS NULL"
        : `realmUnitId = "${opts.realmUnitId}"`,
    );
  }
  if (opts.parentCommentId !== undefined) {
    filter.push(
      opts.parentCommentId === null
        ? "parentCommentId IS NULL"
        : `parentCommentId = "${opts.parentCommentId}"`,
    );
  }
  if (opts.authorUserId) {
    filter.push(`authorUserId = "${opts.authorUserId}"`);
  }
  if (opts.language) {
    filter.push(`language = "${opts.language}"`);
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
  if (opts.moderationStatus) {
    filter.push(`moderationStatus = "${opts.moderationStatus}"`);
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

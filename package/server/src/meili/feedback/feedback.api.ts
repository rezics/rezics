import type {
  FeedbackListQuery,
  FeedbackSearchDocument,
  FeedbackSearchResult,
} from "@rezics/contract";
import type { SearchResponse } from "@rezics/search";
import { searchClient } from "../search-client";
import { defaultSort } from "../util";
/**
 * Low-level search API that accepts a fully-constructed Meilisearch query string.
 *
 * Prefer using {@link searchFeedbacks} in new code, which accepts a typed
 * {@link FeedbackListQuery} object and builds the query for you.
 *
 * 底层搜索 API，接受一个已完整构造好的 Meilisearch 查询字符串。
 *
 * 新代码请优先使用 {@link searchFeedbacks}，它接受类型化的
 * {@link FeedbackListQuery} 对象并为你构造查询。
 */
export async function searchFeedbacksRaw(
  q: string,
  options?: {
    offset?: number;
    limit?: number;
    filter?: string | string[];
    sort?: string[];
  },
): Promise<SearchResponse<FeedbackSearchDocument>> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;

  return searchClient.feedbackIndex.search<FeedbackSearchDocument>(q, {
    offset,
    limit,
    filter: options?.filter,
    sort: options?.sort,
  });
}

function escapeValue(value: string): string {
  return value.trim().replace(/"/g, '\\"');
}

/**
 * Higher-level search API for feedbacks.
 *
 * - Input is {@link FeedbackListQuery} from `@rezics/contract`.
 * - It maps contract fields like `userId`, `targetKind`, `targetId`,
 *   `addressedUnitId`, `type`, `resolved`, `createdAtFrom`, and `createdAtTo`
 *   into Meilisearch filter expressions.
 *
 * This is the main function you should consume from other packages.
 *
 * 面向 feedback 的高层搜索 API。
 *
 * - 输入为来自 `@rezics/contract` 的 {@link FeedbackListQuery}。
 * - 它将 `userId`、`targetKind`、`targetId`、`addressedUnitId`、`type`、
 *   `resolved`、`createdAtFrom`、`createdAtTo` 等契约字段映射为 Meilisearch
 *   过滤表达式。
 *
 * 这是其他包应当使用的主函数。
 */
export async function searchFeedbacks(
  opts: FeedbackListQuery,
): Promise<FeedbackSearchResult> {
  const q = opts.q || "";

  const filter: string[] = [];

  if (opts.userId) {
    filter.push(`userId = "${escapeValue(opts.userId)}"`);
  }

  if (opts.targetKind) {
    filter.push(`targetKind = "${escapeValue(opts.targetKind)}"`);
  }

  if (opts.targetId) {
    filter.push(`targetId = "${escapeValue(opts.targetId)}"`);
  }

  if (opts.addressedUnitId) {
    filter.push(`addressedUnitId = "${escapeValue(opts.addressedUnitId)}"`);
  }

  if (opts.type) {
    filter.push(`type = "${escapeValue(opts.type)}"`);
  }

  if (typeof opts.resolved === "boolean") {
    filter.push(`resolved = ${opts.resolved ? "true" : "false"}`);
  }

  if (opts.createdAtFrom) {
    filter.push(`createdAt >= "${opts.createdAtFrom}"`);
  }

  if (opts.createdAtTo) {
    filter.push(`createdAt <= "${opts.createdAtTo}"`);
  }

  // Feedback defaults to descending order by creation time.
  // Feedback 默认按创建时间倒序。
  const sort: string[] = ["createdAt:desc"];

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const resp = await searchFeedbacksRaw(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : defaultSort,
  });

  return {
    feedbacks: resp.hits as FeedbackSearchDocument[],
    total: resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

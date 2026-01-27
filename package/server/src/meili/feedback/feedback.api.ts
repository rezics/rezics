import type {FeedbackListQuery} from '@package/contract';
import {feedbackIndex} from '@package/search';
import type {
  FeedbackSearchDocument,
  FeedbackSearchResult,
} from '@package/contract';
import type {SearchResponse} from '@package/search';
import {defaultSort} from '../util';
/**
 * Low-level search API that accepts a fully-constructed Meilisearch query string.
 *
 * Prefer using {@link searchFeedbacks} in new code, which accepts a typed
 * {@link FeedbackListQuery} object and builds the query for you.
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

  // eslint-disable-next-line no-console
  console.log('searchFeedbacksRaw', q, options);
  return feedbackIndex.search<FeedbackSearchDocument>(q, {
    offset,
    limit,
    filter: options?.filter,
    sort: options?.sort,
  });
}

function escape(value: string): string {
  return value.trim().replace(/"/g, '\\"');
}

/**
 * Higher-level search API for feedbacks.
 *
 * - Input is {@link FeedbackListQuery} from `@package/contract`.
 * - It maps contract fields like `userId`, `unitId`, `type`, `resolved`,
 *   `createdAtFrom`, `createdAtTo` into Meilisearch filter expressions.
 *
 * This is the main function you should consume from other packages.
 */
export async function searchFeedbacks(
  opts: FeedbackListQuery,
): Promise<FeedbackSearchResult> {
  // Use the provided query string or default to empty
  const q = opts.q || '';

  const filter: string[] = [];

  if (opts.userId) {
    filter.push(`userId = "${escape(opts.userId)}"`);
  }

  if (opts.unitId) {
    filter.push(`unitId = "${escape(opts.unitId)}"`);
  }

  if (opts.type) {
    filter.push(`type = "${escape(opts.type)}"`);
  }

  if (typeof opts.resolved === 'boolean') {
    filter.push(`resolved = ${opts.resolved ? 'true' : 'false'}`);
  }

  if (opts.createdAtFrom) {
    filter.push(`createdAt >= "${opts.createdAtFrom}"`);
  }

  if (opts.createdAtTo) {
    filter.push(`createdAt <= "${opts.createdAtTo}"`);
  }

  // Feedback 默认按创建时间倒序
  const sort: string[] = ['createdAt:desc'];

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

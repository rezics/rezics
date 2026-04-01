import type {ReadlistListQuery} from '@package/contract';
import {searchClient} from '../search-client';
import type {ReadlistSearchDocument, ReadlistSearchResult} from './index';
import type {SearchResponse} from '@package/search';
import {defaultSort} from '../util';
/**
 * Low-level search API that accepts a fully-constructed Meilisearch query string.
 *
 * Prefer using {@link searchReadlists} in new code, which accepts a typed
 * {@link ReadlistListQuery} object and builds the query for you.
 */
export async function searchReadlistsRaw(
  q: string,
  options?: {
    offset?: number;
    limit?: number;
    filter?: string | string[];
    sort?: string[];
  },
): Promise<SearchResponse<ReadlistSearchDocument>> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;

  // eslint-disable-next-line no-console
  console.log('searchReadlistsRaw', q, options);
  return searchClient.readlistIndex.search<ReadlistSearchDocument>(q, {
    offset,
    limit,
    filter: options?.filter,
    sort: options?.sort,
  });
}

function parseCsv(value?: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function escapeValues(values: string[]): string {
  return values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(', ');
}

/**
 * Higher-level search API for readlists.
 *
 * - Input is {@link ReadlistListQuery} from `@package/contract`.
 * - It maps contract fields like `q`, `userId`, `tags`, `hasBookUnitId`,
 *   `hasReviewUnitId`, etc. into Meilisearch filter expressions and sort options.
 *
 * This is the main function you should consume from other packages.
 */
export async function searchReadlists(
  opts: ReadlistListQuery,
): Promise<ReadlistSearchResult> {
  const q = opts.q ?? '';

  const filter: string[] = [];

  // User filter
  if (opts.userId) {
    filter.push(`userId = "${opts.userId.trim().replace(/"/g, '\\"')}"`);
  }

  // Tags (tag / tags)
  const tagList = [...parseCsv(opts.tags), ...(opts.tag ? [opts.tag] : [])];
  if (tagList.length > 0) {
    filter.push(`tags IN [${escapeValues(tagList)}]`);
  }

  // Containing specific book / review
  if (opts.hasBookUnitId) {
    filter.push(
      `bookIds = "${opts.hasBookUnitId.trim().replace(/"/g, '\\"')}"`,
    );
  }
  if (opts.hasReviewUnitId) {
    filter.push(
      `reviewIds = "${opts.hasReviewUnitId.trim().replace(/"/g, '\\"')}"`,
    );
  }

  // Sort
  const sort: string[] = [];
  const sortType = opts.sort?.type ?? 'createdAt';
  const sortOrder = opts.sort?.order?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  // Meilisearch 里目前只声明了 createdAt / updatedAt 为 sortable
  if (sortType === 'createdAt' || sortType === 'updatedAt') {
    sort.push(`${sortType}:${sortOrder}`);
  } else {
    // 其它类型（likeCount / commentCount / viewCount）暂时退化为 createdAt
    sort.push(`createdAt:${sortOrder}`);
  }

  const limit = opts.limit ?? 20;
  const offset = opts.start ?? 0;

  const resp = await searchReadlistsRaw(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : defaultSort,
  });

  // Optionally clip content to keep payload small
  const hits: ReadlistSearchDocument[] = resp.hits.map(hit => {
    const content = hit.content ?? '';
    return {
      ...hit,
      content: content.length > 500 ? content.slice(0, 500) + '...' : content,
    };
  });

  return {
    readlists: hits,
    total: resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

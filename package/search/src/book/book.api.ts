import type {BookQueryOptions} from '@package/contract';
import {toBookQueryString} from '@package/contract';
import type {SearchResponse} from 'meilisearch';
import {bookIndex} from '../meili_index';
import type {BookSearchDocument, BookSearchResult} from './interface';

/**
 * Low-level search API that accepts a fully-constructed Meilisearch query string.
 *
 * Prefer using {@link searchBooks} in new code, which accepts a typed
 * {@link BookQueryOptions} object and builds the query for you.
 */
export async function searchBooksRaw(
  q: string,
  options?: {
    page?: number;
    limit?: number;
    filter?: string | string[];
    sort?: string[];
  },
): Promise<SearchResponse<BookSearchDocument>> {
  const page = options?.page ?? 1;
  const hitsPerPage = options?.limit ?? 20;

  return bookIndex.search<BookSearchDocument>(q, {
    page,
    hitsPerPage,
    filter: options?.filter,
    sort: options?.sort,
  });
}

/**
 * Higher-level search API for books.
 *
 * - Input is {@link BookQueryOptions} from `@package/contract/src/search.ts`.
 * - It uses {@link toBookQueryString} to build the text query.
 * - It maps contract fields like `nsfw`, `tags`, `authorIds` etc. into
 *   Meilisearch filter expressions and sort options.
 *
 * This is the main function you should consume from other packages.
 */
export async function searchBooks(
  opts: BookQueryOptions,
): Promise<BookSearchResult> {
  const q = toBookQueryString(opts);

  const filter: string[] = [];

  // NSFW filter: default to non-NSFW if caller does not explicitly request NSFW.
  if (opts.nsfw === true) {
    filter.push('nsfw = true');
  } else if (opts.nsfw === false || opts.nsfw === undefined) {
    filter.push('nsfw = false');
  }

  if (opts.tags?.length) {
    filter.push(
      `tags IN [${opts.tags
        .map(t => `"${t.replace(/"/g, '\\"')}"`)
        .join(', ')}]`,
    );
  }

  if (opts.authorIds?.length) {
    filter.push(
      `authorIds IN [${opts.authorIds
        .map(id => `"${id.replace(/"/g, '\\"')}"`)
        .join(', ')}]`,
    );
  }

  if (opts.pressIds?.length) {
    filter.push(
      `pressIds IN [${opts.pressIds
        .map(id => `"${id.replace(/"/g, '\\"')}"`)
        .join(', ')}]`,
    );
  }

  if (opts.producerIds?.length) {
    filter.push(
      `producerIds IN [${opts.producerIds
        .map(id => `"${id.replace(/"/g, '\\"')}"`)
        .join(', ')}]`,
    );
  }

  const sort: string[] = [];
  if (opts.sort?.type && opts.sort.type !== 'relevance') {
    const order = opts.sort.order ?? 'desc';
    sort.push(`${opts.sort.type}:${order}`);
  }

  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const start = opts.start ?? 0;
  const page = Math.floor(start / limit) + 1;

  const resp = await searchBooksRaw(q, {
    page,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    hits: resp.hits as BookSearchDocument[],
    page: resp.page ?? page,
    totalPages: resp.totalPages ?? 1,
    totalHits: resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

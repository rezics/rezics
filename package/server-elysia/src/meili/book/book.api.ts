import type {BookQueryOptions} from '@package/contract';
import {toBookQueryString} from '@package/contract';
import {bookIndex} from '@package/search/src/meili_index';
import type {BookSearchDocument, BookSearchResult} from './index';
import type {SearchResponse} from '@package/search/src/index';
/**
 * Low-level search API that accepts a fully-constructed Meilisearch query string.
 *
 * Prefer using {@link searchBooks} in new code, which accepts a typed
 * {@link BookQueryOptions} object and builds the query for you.
 */
export async function searchBooksRaw(
  q: string,
  options?: {
    offset?: number;
    limit?: number;
    filter?: string | string[];
    sort?: string[];
  },
): Promise<SearchResponse<BookSearchDocument>> {
  const offset = options?.offset ?? 1;
  const limit = options?.limit ?? 20;

  console.log('searchBooksRaw', q, options);
  return bookIndex.search<BookSearchDocument>(q, {
    offset,
    limit,
    filter: options?.filter,
    sort: options?.sort,
  });
}

function buildTextLengthFilter(input: number | {min?: number; max?: number}) {
  if (typeof input === 'number') {
    return `textLength = ${input}`;
  }

  const clauses = [];
  if (input.min != null) clauses.push(`textLength >= ${input.min}`);
  if (input.max != null) clauses.push(`textLength <= ${input.max}`);

  return clauses.length ? clauses.join(' AND ') : undefined;
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
  // const q = toBookQueryString(opts);
  const q = opts.keyword ?? '';

  const filter: string[] = [];

  // NSFW filter: default to non-NSFW if caller does not explicitly request NSFW.
  if (opts.nsfw === true) {
    filter.push('nsfw = true');
  } else if (opts.nsfw === false || opts.nsfw === undefined) {
    filter.push('nsfw = false');
  }

  if (opts.tags?.length) {
    filter.push(
      `tagSearch IN [${opts.tags
        .map(t => `"${t.replace(/"/g, '\\"')}"`)
        .join(', ')}]`,
    );
  }

  if (opts.textLength) {
    const tmp: any[] = opts.textLength.split('-').map(Number);
    let min = 0,
      max = 0;
    if (tmp.length === 2) {
      min = tmp[0];
      max = tmp[1];
    }
    const tmpFilter = buildTextLengthFilter({min, max});
    if (tmpFilter) {
      filter.push(tmpFilter);
    }
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

  const limit = opts.limit ?? 100;
  const offset = opts.start ?? 0;

  const resp = await searchBooksRaw(q, {
    offset,
    limit,
    filter: filter.length > 0 ? filter : undefined,
    sort: sort.length > 0 ? sort : undefined,
  });

  return {
    books: resp.hits as BookSearchDocument[],
    // others: resp,
    total: resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

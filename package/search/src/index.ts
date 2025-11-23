// index.ts - Public entrypoint for the search package
// This file provides a small, well-documented API around Meilisearch,
// hiding low-level details and wiring with the rest of the application.

import type {BookQueryOptions} from '@package/contract';
import {toBookQueryString} from '@package/contract';
import type {SearchResponse} from 'meilisearch';
import {meili} from './client';
import {bookIndex, initBookIndex} from './meili_index';
import {
  addOrUpdateBooks,
  deleteAllBooks,
  deleteBooks,
} from './documents';
import {
  getSearchKey,
  getAdminKey,
  listKeys,
  deleteKey,
} from './keys';
import {syncAllBooks} from './sync';

/**
 * Shape of a book document stored in the Meilisearch `books` index.
 *
 * This is intentionally compact and denormalized to keep search fast.
 */
export interface BookSearchDocument {
  /** Unit ID of the book, used as the document ID and for linking back to the main DB record. */
  id: string;
  /** Book title. */
  title: string;
  /** Optional long description or summary. */
  description: string | null;
  /** Tag names attached to the book (used for faceting/filtering). */
  tags: string[];
  /** Author display names. */
  authors: string[];
  /** Whether the book is NSFW. */
  nsfw: boolean;
  /** ISO timestamp when the book was created. */
  createdAt: string;
  /** ISO timestamp when the book was last updated. */
  updatedAt: string;
  /** Optional author IDs for precise filtering. */
  authorIds?: string[];
  /** Optional press IDs for precise filtering. */
  pressIds?: string[];
  /** Optional producer IDs for precise filtering. */
  producerIds?: string[];
}

/**
 * Normalized search result for book queries.
 */
export interface BookSearchResult {
  /** Hits for the current page. */
  hits: BookSearchDocument[];
  /** 1-based current page index. */
  page: number;
  /** Total number of pages available. */
  totalPages: number;
  /** Total number of matched hits. */
  totalHits: number;
  /** Meilisearch processing time in milliseconds. */
  processingTimeMs: number;
  /** Final query string actually sent to Meilisearch. */
  query: string;
}

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
      `tags IN [${opts.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`,
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

/**
 * Initialize the `books` index in Meilisearch with the correct settings
 * (searchable, filterable and sortable attributes).
 *
 * Safe to call multiple times; Meilisearch will update the settings as needed.
 */
export {initBookIndex};

/**
 * Perform a full synchronization of all books from the primary database
 * into the Meilisearch `books` index.
 *
 * This is usually run as an admin/maintenance operation, not per request.
 */
export {syncAllBooks};

/**
 * Upsert an array of book documents into Meilisearch.
 *
 * Prefer {@link syncAllBooks} for bulk sync from the DB; use this for
 * fine-grained updates when a single book changes.
 */
export {addOrUpdateBooks, deleteBooks, deleteAllBooks};

/**
 * Meilisearch API client instance used internally by this package.
 *
 * You generally do not need to use this directly; it is exported for
 * advanced use cases.
 */
export {meili};

/**
 * Create a Meilisearch key that is restricted to `search` actions on the
 * `books` index. This key is suitable to be used by frontend clients.
 *
 * IMPORTANT: You should only expose the resulting key to trusted clients
 * and never leak the master key from environment variables.
 */
export {getSearchKey};

/**
 * Create a short-lived Meilisearch admin key that has full permissions.
 *
 * This should only be used in secure, server-side contexts (e.g. CLI tools
 * or admin panels) and never returned directly to untrusted clients.
 */
export {getAdminKey};

/**
 * List all existing Meilisearch keys.
 */
export {listKeys};

/**
 * Delete a Meilisearch key by its UID.
 */
export {deleteKey};



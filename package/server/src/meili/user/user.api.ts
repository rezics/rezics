import type {UserListQuery} from '@package/contract';
import {userIndex} from '@package/search';
import type {UserSearchDocument, UserSearchResult} from './index';
import type {SearchResponse} from '@package/search';

function escapeValue(value: string): string {
  return value.trim().replace(/"/g, '\\"');
}

/**
 * Low-level search API that accepts a fully-constructed Meilisearch query string.
 *
 * Prefer using {@link searchUsers} in new code, which accepts a typed
 * {@link UserListQuery} object and builds the query for you.
 */
export async function searchUsersRaw(
  q: string,
  options?: {
    offset?: number;
    limit?: number;
    filter?: string | string[];
    sort?: string[];
  },
): Promise<SearchResponse<UserSearchDocument>> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;

  // eslint-disable-next-line no-console
  console.log('searchUsersRaw', q, options);

  return userIndex.search<UserSearchDocument>(q, {
    offset,
    limit,
    filter: options?.filter,
    sort: options?.sort,
  });
}

/**
 * Higher-level search API for users.
 *
 * - Input is {@link UserListQuery} from `@package/contract`.
 * - It maps contract fields like `q`, `email`, `slug`, `type`, `page`, `limit`
 *   into Meilisearch filter expressions and pagination options.
 */
export async function searchUsers(
  opts: UserListQuery,
): Promise<UserSearchResult> {
  const q = opts.q ?? '';

  const filter: string[] = [];

  if (opts.email) {
    filter.push(`email = "${escapeValue(opts.email)}"`);
  }

  if (opts.slug) {
    filter.push(`slug = "${escapeValue(opts.slug)}"`);
  }

  if (opts.type) {
    filter.push(`type = "${escapeValue(opts.type)}"`);
  }

  const pageNum = Math.max(Number(opts.page ?? 1), 1);
  const rawLimit = Math.max(1, Math.min(Number(opts.limit ?? 20), 100));
  const offset = (pageNum - 1) * rawLimit;

  const sort: string[] = ['joinDate:desc'];

  const resp = await searchUsersRaw(q, {
    offset,
    limit: rawLimit,
    filter: filter.length > 0 ? filter : undefined,
    sort,
  });

  return {
    users: resp.hits as UserSearchDocument[],
    total: resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

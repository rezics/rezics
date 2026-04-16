import type { UserListQuery } from "@rezics/contract";
import type { SearchResponse } from "@rezics/search";
import { searchClient } from "../search-client";
import type { UserSearchDocument, UserSearchResult } from "./index";

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
  console.log("searchUsersRaw", q, options);

  return searchClient.userIndex.search<UserSearchDocument>(q, {
    offset,
    limit,
    filter: options?.filter,
    sort: options?.sort,
  });
}

/**
 * Higher-level search API for users.
 *
 * - Input is {@link UserListQuery} from `@rezics/contract`.
 * - It maps contract fields like `q`, `slug`, `type`, `page`, `limit`
 *   into Meilisearch filter expressions and pagination options.
 */
export async function searchUsers(
  opts: UserListQuery,
): Promise<UserSearchResult> {
  const q = opts.q ?? "";

  const filter: string[] = [];

  if (opts.slug) {
    filter.push(`slug = "${escapeValue(opts.slug)}"`);
  }

  const pageNum = Math.max(Number(opts.page ?? 1), 1);
  const rawLimit = Math.max(1, Math.min(Number(opts.limit ?? 20), 100));
  const offset = (pageNum - 1) * rawLimit;

  const sort: string[] = ["joinDate:desc"];

  const resp = await searchUsersRaw(q, {
    offset,
    limit: rawLimit,
    filter: filter.length > 0 ? filter : undefined,
    sort,
  });

  return {
    users: resp.hits as UserSearchDocument[],
    total: resp.estimatedTotalHits ?? resp.hits.length,
    processingTimeMs: resp.processingTimeMs,
    query: resp.query ?? q,
  };
}

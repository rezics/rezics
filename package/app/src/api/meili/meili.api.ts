/**
 * Meilisearch Book API client
 *
 * Frontend wrapper around the backend `/meili/books/search` endpoint.
 */

import type {BookQueryOptions} from '@package/contract';
import {buildQueryString} from '../utils/buildQuery';
import {apiFetch} from '../react-query/http';

/**
 * Shape of a single book document returned by Meilisearch.
 *
 * This mirrors (a subset of) the server-side `BookSearchDocument` type.
 * Kept local here to avoid pulling the Node-only `@package/search` package
 * into the browser bundle.
 */
export type MeiliBookHit = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  authors: string[];
  nsfw: boolean;
  createdAt: string;
  updatedAt: string;
  authorIds?: string[];
  pressIds?: string[];
  producerIds?: string[];
};

/**
 * Normalized Meilisearch book search result.
 *
 * This mirrors the backend `BookSearchResult` shape.
 */
export type MeiliBookSearchResult = {
  hits: MeiliBookHit[];
  page: number;
  totalPages: number;
  totalHits: number;
  processingTimeMs: number;
  query: string;
};

export const meiliBookApi = {
  /**
   * Search books via backend Meilisearch controller.
   *
   * The backend expects a `BookQueryOptions` object encoded in the query string.
   */
  search: async (options: BookQueryOptions): Promise<MeiliBookSearchResult> => {
    return apiFetch<MeiliBookSearchResult>(
      `/meili/books/search${buildQueryString(options as any)}`,
    );
  },
};

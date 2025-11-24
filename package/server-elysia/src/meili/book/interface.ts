/**
 * Shape of a book document stored in the Meilisearch `books` index.
 *
 * This is intentionally compact and denormalized to keep search fast.
 */
export interface BookSearchDocument {
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
}

/**
 * Normalized search result for book queries.
 */
export interface BookSearchResult {
  /** Hits for the current page. */
  books: BookSearchDocument[];
  /** Others. */
  others?: any;
  /** Total number of matched hits. */
  total: number;
  /** Meilisearch processing time in milliseconds. */
  processingTimeMs: number;
  /** Final query string actually sent to Meilisearch. */
  query: string;
}

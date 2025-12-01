/**
 * Shape of a book document stored in the Meilisearch `books` index.
 *
 * This is intentionally compact and denormalized to keep search fast.
 */
export interface BookSearchDocument {
  id: string;
  // search fields
  title: string;
  description: string | null;
  tagSearch: string[];
  authors: string[];
  presses: string[];
  producers: string[];
  textLength: number;
  nsfw: boolean;
  authorIds: string[];
  pressIds: string[];
  producerIds: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
  // result fields
  unitId: string;
  author: any;
  press: any;
  producer: any;
  tags: any[];
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

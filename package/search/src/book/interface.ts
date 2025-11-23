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

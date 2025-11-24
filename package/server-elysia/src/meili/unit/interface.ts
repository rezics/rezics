/**
 * Shape of a unit document stored in the Meilisearch `units` index.
 *
 * This is intentionally compact and denormalized to keep search fast.
 * It contains both fields used for search/filtering and richer
 * result fields for rendering in the UI.
 */
export interface UnitSearchDocument {
  id: string;

  // search fields
  title?: string | null;
  content?: string | null;
  tags?: string[];
  type?: string;
  status?: string;
  userId?: string;
  domainIds?: string[];
  targetUnitId?: string | null;
  hasTarget?: boolean;
  nsfw?: boolean;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;

  // result fields (denormalized from Unit relations/metadata)
  unitId?: string;
  user?: any;
  metadata?: any;
  tagObjects?: any[];
  reactionSummaries?: any[];
}

/**
 * Normalized search result for unit queries.
 */
export interface UnitSearchResult {
  /** Hits for the current page. */
  units: UnitSearchDocument[];
  /** Total number of matched hits. */
  total: number;
  /** Meilisearch processing time in milliseconds. */
  processingTimeMs: number;
  /** Final query string actually sent to Meilisearch. */
  query: string;
}

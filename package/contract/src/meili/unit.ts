// TODO(search-redesign): replaced by unified content index

/**
 * Shape of a unit document stored in the Meilisearch `units` index.
 * Updated for new schema: no title/content on Unit, translations-based search.
 */
export interface UnitSearchDocument {
  id: string;
  // search fields (flattened from UnitTranslation)
  title?: string | null;
  description?: string | null;
  tags?: string[];
  type?: string;
  status?: string;
  visibility?: string;
  userId?: string;
  workUnitId?: string | null;
  nsfw?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  publishedAt?: string | null;
  // result fields
  unitId?: string;
  user?: any;
  translations?: any[];
  reactionSummaries?: any[];
}

/**
 * Normalized search result for unit queries.
 */
export interface UnitSearchResult {
  units: UnitSearchDocument[];
  total: number;
  processingTimeMs: number;
  query: string;
}

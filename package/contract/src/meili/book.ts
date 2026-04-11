// TODO(search-redesign): replaced by unified content index

/**
 * Shape of a book document stored in the Meilisearch `books` index.
 * Updated for new schema: translations, personCredits, orgCredits, scored tags.
 */
export interface BookSearchDocument {
  id: string;
  // search fields (flattened from UnitTranslation)
  title: string;
  description: string | null;
  isbn13: string | null;
  tagLabels: string[];
  personNames: string[];
  orgNames: string[];
  textLength: number;
  nsfw: boolean;
  isLicensed: boolean;
  personIds: string[];
  orgIds: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
  extra: any;
  // result fields
  unitId: string;
  coverAssetUnitId: string | null;
  defaultLanguage: string | null;
  personCredits: any[];
  orgCredits: any[];
  tags: any[];
}

/**
 * Normalized search result for book queries.
 */
export interface BookSearchResult {
  books: BookSearchDocument[];
  others?: any;
  total: number;
  processingTimeMs: number;
  query: string;
}

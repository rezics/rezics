// Readlist search — DEPRECATED: replaced by Shelf
// TODO(search-redesign): replaced by unified content index

/** @deprecated Use ShelfSearchDocument */
export interface ReadlistSearchDocument {
  id: string;
  title?: string | null;
  content?: string | null;
  tags?: string[];
  nsfw?: boolean;
  userId?: string;
  type?: string;
  status?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  unitId?: string;
  user?: any;
}

/** @deprecated Use ShelfSearchResult */
export interface ReadlistSearchResult {
  readlists: ReadlistSearchDocument[];
  total: number;
  processingTimeMs: number;
  query: string;
}

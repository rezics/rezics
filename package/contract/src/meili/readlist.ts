/**
 * Shape of a readlist document stored in the Meilisearch `readlists` index.
 *
 *  - 搜索字段来自绑定的 Unit（title / content / tags / nsfw / userId / domains）
 *  - 过滤字段包含 bookIds / reviewIds 等
 *  - 结果字段保留了部分反规范化的信息，方便前端直接渲染
 */
export interface ReadlistSearchDocument {
  id: string;

  // search fields
  title?: string | null;
  content?: string | null;
  tags?: string[];
  nsfw?: boolean;
  userId?: string;
  type?: string;
  status?: string;
  domainIds?: string[];
  targetUnitId?: string | null;

  // filter fields
  bookIds?: string[];
  reviewIds?: string[];

  // optional visual field extracted from metadata
  coverUrl?: string | null;

  createdAt?: string | Date;
  updatedAt?: string | Date;

  // result / denormalized fields
  unitId?: string;
  user?: any;
  metadata?: any;
  tagObjects?: any[];
  reactionSummaries?: any[];
}

/**
 * Normalized search result for readlist queries.
 */
export interface ReadlistSearchResult {
  /** Hits for the current page. */
  readlists: ReadlistSearchDocument[];
  /** Total number of matched hits. */
  total: number;
  /** Meilisearch processing time in milliseconds. */
  processingTimeMs: number;
  /** Final query string actually sent to Meilisearch. */
  query: string;
}



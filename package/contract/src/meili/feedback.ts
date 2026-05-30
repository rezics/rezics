import type { FeedbackType } from "../engagement/feedback";

/**
 * Shape of a feedback document stored in the Meilisearch `feedbacks` index.
 *
 * Intentionally kept close to `FeedbackDTO` so that most UIs can reuse it
 * directly without a separate mapping step.
 */
export interface FeedbackSearchDocument {
  id: string;
  userId: string;
  unitId?: string | null;
  url?: string | null;
  content: string;
  type: FeedbackType;
  resolved: boolean;
  resolvedAt?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Normalized search result for feedback queries.
 */
export interface FeedbackSearchResult {
  /** Hits for the current page. */
  feedbacks: FeedbackSearchDocument[];
  /** Total number of matched hits. */
  total: number;
  /** Meilisearch processing time in milliseconds. */
  processingTimeMs: number;
  /** Final query string actually sent to Meilisearch. */
  query: string;
}

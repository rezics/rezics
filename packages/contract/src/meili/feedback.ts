import type { FeedbackType } from "../engagement/feedback";
import type { ModerationTargetKind } from "../realm/governance";

/**
 * Shape of a feedback document stored in the Meilisearch `feedbacks` index.
 *
 * Intentionally kept close to `FeedbackDTO` so that most UIs can reuse it
 * directly without a separate mapping step.
 * 存储在 Meilisearch `feedbacks` 索引中的反馈文档结构。
 *
 * 有意与 `FeedbackDTO` 保持接近，以便大多数 UI 无需单独的映射步骤即可直接复用。
 */
export interface FeedbackSearchDocument {
  id: string;
  userId: string;
  targetKind?: ModerationTargetKind | null;
  targetId?: string | null;
  addressedUnitId?: string | null;
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
 * 反馈查询的归一化搜索结果。
 */
export interface FeedbackSearchResult {
  /**
   * Hits for the current page.
   * 当前页的命中结果。
   */
  feedbacks: FeedbackSearchDocument[];
  /**
   * Total number of matched hits.
   * 匹配命中的总数。
   */
  total: number;
  /**
   * Meilisearch processing time in milliseconds.
   * Meilisearch 处理时间（毫秒）。
   */
  processingTimeMs: number;
  /**
   * Final query string actually sent to Meilisearch.
   * 实际发送给 Meilisearch 的最终查询字符串。
   */
  query: string;
}

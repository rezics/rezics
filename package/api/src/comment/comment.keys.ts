/**
 * React Query key factory for Comment queries
 * Follows pattern used in `book.keys.ts`.
 */

import type { CommentListFilters, CommentTreeQuery } from "./comment.types";

export const commentKeys = {
  /** Base key for all comment queries */
  all: () => ["comments"] as const,

  /**
   * Keys for comment tree queries
   */
  commentTrees: () => [...commentKeys.all(), "commentTree"] as const,
  commentTree: (unitId: string, params?: CommentTreeQuery) =>
    [...commentKeys.commentTrees(), unitId, params] as const,

  /** Keys for listing slices */
  lists: () => [...commentKeys.all(), "list"] as const,
  list: (filters?: CommentListFilters) =>
    [...commentKeys.lists(), filters] as const,

  /** Keys for detail queries */
  details: () => [...commentKeys.all(), "detail"] as const,
  detail: (unitId: string) => [...commentKeys.details(), unitId] as const,

  /** Convenience key root for a specific tree by rootUnitId */
  tree: (rootUnitId: string) =>
    [...commentKeys.all(), "tree", rootUnitId] as const,
} as const;

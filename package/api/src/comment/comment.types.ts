/**
 * Comment domain types (frontend-specific helpers)
 * Raw DTO & input types come from `@rezics/contract`.
 */

import type {
  CommentDTO,
  CommentTreeQuery,
  CreateCommentInput,
  UpdateCommentInput,
} from "@rezics/contract";

/**
 * Filters used for listing comments.
 * Mirrors backend query params (`commentListQuerySchema`).
 */
export type CommentListFilters = {
  /** Root Unit id of the comment tree (required) */
  rootUnitId: string;
  /** Optional parent comment id to fetch its direct children */
  parentId?: string;
  /** Maximum depth to traverse when parentId not provided */
  maxDepth?: number;
  /** Pagination start offset (acts like page index) */
  start?: number;
  /** Page size (limit of items to return) */
  limit?: number;
  /** Sort order, defaults to ascending if omitted */
  order?: "asc" | "desc";
};

/** Example form shape for creating a comment (UI layer) */
export type CommentFormData = {
  content: string;
};

export type {
  CommentDTO,
  CommentTreeQuery,
  CreateCommentInput,
  UpdateCommentInput,
};

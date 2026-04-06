/**
 * Comment API - Unified export entry point
 * Mirrors the structure used by `book.ts` for consistency.
 *
 * File organization:
 * - comment.types.ts: TypeScript types & helper interfaces
 * - comment.keys.ts: React Query key factory
 * - comment.api.ts: Direct API client functions
 * - comment.queries.ts: Query option builders
 * - comment.mutations.ts: Mutation hooks
 * - comment.ts: Unified exports (this file)
 */

// API Client
export { commentApi } from "./comment.api";

// Query Keys
export { commentKeys } from "./comment.keys";
// Mutation Hooks
export {
  commentMutations,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useUpdateCommentMutation,
} from "./comment.mutations";

// Query Configurations
export {
  commentDetailQuery,
  commentInfiniteListQuery,
  commentListQuery,
  commentQueries,
} from "./comment.queries";
// Types
export type {
  CommentDTO,
  CommentFormData,
  CommentListFilters,
  CreateCommentInput,
  UpdateCommentInput,
} from "./comment.types";

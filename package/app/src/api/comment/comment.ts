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

// Types
export type {
  CommentDTO,
  CreateCommentInput,
  UpdateCommentInput,
  CommentListFilters,
  CommentFormData,
} from './comment.types';

// Query Keys
export {commentKeys} from './comment.keys';

// API Client
export {commentApi} from './comment.api';

// Query Configurations
export {
  commentQueries,
  commentListQuery,
  commentDetailQuery,
  commentInfiniteListQuery,
} from './comment.queries';

// Mutation Hooks
export {
  commentMutations,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
} from './comment.mutations';

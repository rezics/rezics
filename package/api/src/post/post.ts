/**
 * Post API - Main entry point
 * Post is the unified discussion primitive replacing Comment + Review.
 *
 * File organization:
 * - post.types.ts: TypeScript types and interfaces
 * - post.keys.ts: React Query key factory
 * - post.api.ts: API client functions
 * - post.queries.ts: Query configurations
 * - post.mutations.ts: Mutation hooks
 * - post.ts: Main entry (this file) - unified exports
 */

// API Client
export { postApi } from "./post.api";

// Query Keys
export { postKeys } from "./post.keys";
// Mutation Hooks
export {
  postMutations,
  useCreatePostMutation,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "./post.mutations";

// Query Configurations
export {
  postDetailQuery,
  postInfiniteListQuery,
  postListQuery,
  postQueries,
  postRepliesQuery,
  postsByAuthorQuery,
  postsByRealmQuery,
  postsByTargetQuery,
  postThreadQuery,
} from "./post.queries";
// Types
export type {
  CreatePostInput,
  PostDTO,
  PostFilters,
  PostFormData,
  PostListResponse,
  PostResponse,
  PostSortOption,
  PostView,
  UpdatePostInput,
} from "./post.types";

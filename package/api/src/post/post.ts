/**
 * Post API - Main entry point
 * Posts are top-level discussion entities. Reply trees use comment APIs.
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
  useAcceptAnswerMutation,
  useCreatePostMutation,
  useCreateWikiPostMutation,
  useDeletePostMutation,
  usePinCommentMutation,
  useSetPostPublicationMutation,
  useSetPostStateMutation,
  useSubmitPostToRealmMutation,
  useUnacceptAnswerMutation,
  useUnpinCommentMutation,
  useUpdatePostMutation,
  useUpdateWikiPostContentMutation,
} from "./post.mutations";

// Query Configurations
export {
  postDetailQuery,
  postInfiniteListQuery,
  postListQuery,
  postQueries,
  postsByAuthorQuery,
  postsByRealmQuery,
  postsByTargetQuery,
  postsByVariantQuery,
  wikiPostsByRealmQuery,
  wikiPostsByTargetQuery,
} from "./post.queries";
// Types
export type {
  CreatePostInput,
  CreateRootPostInput,
  PostDTO,
  PostFilters,
  PostFormData,
  PostListResponse,
  PostResponse,
  PostSortOption,
  PostView,
  UpdatePostInput,
} from "./post.types";

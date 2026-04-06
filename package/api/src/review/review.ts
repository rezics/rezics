/**
 * Review API - Main entry point
 * Provides a unified interface for all review-related operations
 */

// API Client
export { reviewApi } from "./review.api";

// Query Keys
export { reviewKeys } from "./review.keys";
// Mutation Hooks
export {
  reviewMutations,
  useCreateReviewMutation,
  useDeleteReviewMutation,
  useUpdateReviewMutation,
} from "./review.mutations";

// Query Configurations
export {
  remarkQueries,
  reviewDetailQuery,
  reviewInfiniteListQuery,
  reviewListQuery,
  reviewQueries,
  reviewSearchQuery,
  reviewsByBookQuery,
  reviewsByUserQuery,
} from "./review.queries";
// Types
export type {
  CreateReviewInput,
  ReviewDTO,
  ReviewFilters,
  ReviewFormData,
  ReviewSortOption,
  UpdateReviewInput,
} from "./review.types";

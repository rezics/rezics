/**
 * Review API - Main entry point
 * Provides a unified interface for all review-related operations
 */

// Types
export type {
  ReviewDTO,
  CreateReviewInput,
  UpdateReviewInput,
  ReviewFormData,
  ReviewFilters,
  ReviewSortOption,
} from './review.types';

// Query Keys
export {reviewKeys} from './review.keys';

// API Client
export {reviewApi} from './review.api';

// Query Configurations
export {
  reviewQueries,
  reviewListQuery,
  reviewDetailQuery,
  reviewSearchQuery,
  reviewsByUserQuery,
  reviewsByBookQuery,
  reviewInfiniteListQuery,
} from './review.queries';

// Mutation Hooks
export {
  reviewMutations,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} from './review.mutations';

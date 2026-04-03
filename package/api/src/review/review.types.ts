/**
 * Review-related TypeScript types and interfaces for the frontend
 */

import type {
  ReviewDTO,
  CreateReviewInput,
  UpdateReviewInput,
  ReviewListQuery,
} from '@rezics/contract';

// Re-export contract types
export type {ReviewDTO, CreateReviewInput, UpdateReviewInput, ReviewListQuery};

/**
 * Extended frontend types
 */
export type ReviewFormData = Omit<CreateReviewInput, 'userId'>;

export type ReviewFilters = Partial<ReviewListQuery>;

export type ReviewSortOption = 'createdAt' | 'updatedAt' | 'rating';

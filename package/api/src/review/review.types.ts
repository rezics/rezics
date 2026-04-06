/**
 * Review-related TypeScript types and interfaces for the frontend
 */

import type {
  CreateReviewInput,
  ReviewDTO,
  ReviewListQuery,
  UpdateReviewInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  CreateReviewInput,
  ReviewDTO,
  ReviewListQuery,
  UpdateReviewInput,
};

/**
 * Extended frontend types
 */
export type ReviewFormData = Omit<CreateReviewInput, "userId">;

export type ReviewFilters = Partial<ReviewListQuery>;

export type ReviewSortOption = "createdAt" | "updatedAt" | "rating";

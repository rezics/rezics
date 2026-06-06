/**
 * Feedback-related TypeScript types and interfaces for the frontend
 *
 * This file re-exports contract types so that UI code can import
 * from a single frontend-friendly location.
 */

import type {
  CreateFeedbackInput,
  FeedbackDTO,
  FeedbackListQuery,
  FeedbackType,
} from "@rezics/contract";

// Re-export contract types
export type {
  CreateFeedbackInput,
  FeedbackDTO,
  FeedbackListQuery,
  FeedbackType,
};

/**
 * Extended frontend types
 */

// Currently identical to CreateFeedbackInput, but defined separately for UI layer customization
export type FeedbackFormData = CreateFeedbackInput;

// Filters used on the frontend for listing feedbacks
export type FeedbackFilters = Partial<FeedbackListQuery>;

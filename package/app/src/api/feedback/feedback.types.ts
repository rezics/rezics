/**
 * Feedback-related TypeScript types and interfaces for the frontend
 */

import type {
  FeedbackDTO,
  CreateFeedbackInput,
  FeedbackListQuery,
} from '@package/contract';

// Re-export contract types
export type {FeedbackDTO, CreateFeedbackInput, FeedbackListQuery};

/**
 * Extended frontend types
 */

// Currently identical to CreateFeedbackInput, but defined separately for UI layer customization
export type FeedbackFormData = CreateFeedbackInput;

// Filters used on the frontend for listing feedbacks
export type FeedbackFilters = Partial<FeedbackListQuery>;



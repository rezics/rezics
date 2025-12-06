/**
 * Feedback API - Main entry point
 * Provides a unified interface for all feedback-related operations
 *
 * File organization:
 * - feedback.types.ts: TypeScript types and interfaces
 * - feedback.keys.ts: React Query key factory
 * - feedback.api.ts: API client functions
 * - feedback.queries.ts: Query configurations
 * - feedback.mutations.ts: Mutation hooks
 * - feedback.ts: Main entry (this file) - unified exports
 */

// Types
export type {
  FeedbackDTO,
  CreateFeedbackInput,
  FeedbackListQuery,
  FeedbackFormData,
  FeedbackFilters,
} from './feedback.types';

// Query Keys
export {feedbackKeys} from './feedback.keys';

// API Client
export {feedbackApi} from './feedback.api';

// Query Configurations
export {
  feedbackQueries,
  feedbackListQuery,
  myFeedbackListQuery,
  feedbacksByUserQuery,
  feedbackDetailQuery,
} from './feedback.queries';

// Mutation Hooks
export {
  feedbackMutations,
  useCreateFeedbackMutation,
  useSetFeedbackResolvedMutation,
} from './feedback.mutations';

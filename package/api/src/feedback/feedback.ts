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

// API Client
export { feedbackApi } from "./feedback.api";

// Query Keys
export { feedbackKeys } from "./feedback.keys";
// Mutation Hooks
export {
  feedbackMutations,
  useCreateFeedbackMutation,
  useSetFeedbackResolvedMutation,
} from "./feedback.mutations";

// Query Configurations
export {
  feedbackDetailQuery,
  feedbackListQuery,
  feedbackQueries,
  feedbacksByUserQuery,
  myFeedbackListQuery,
} from "./feedback.queries";
// Types
export type {
  CreateFeedbackInput,
  FeedbackDTO,
  FeedbackFilters,
  FeedbackFormData,
  FeedbackListQuery,
} from "./feedback.types";

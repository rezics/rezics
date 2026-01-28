/**
 * React Query keys for Feedback queries
 */

import type {FeedbackFilters} from './feedback.types';

export const feedbackKeys = {
  /**
   * Base key for all feedback queries
   */
  all: () => ['feedbacks'] as const,

  /**
   * Keys for list queries
   */
  lists: () => [...feedbackKeys.all(), 'list'] as const,
  list: (filters?: FeedbackFilters) => [...feedbackKeys.lists(), filters] as const,

  /**
   * Keys for "my feedback" queries
   */
  my: (filters?: FeedbackFilters) =>
    [...feedbackKeys.all(), 'my', filters] as const,

  /**
   * Keys for user-specific feedback queries
   */
  byUser: (userId: string, filters?: FeedbackFilters) =>
    [...feedbackKeys.all(), 'user', userId, filters] as const,

  /**
   * Keys for detail queries
   */
  details: () => [...feedbackKeys.all(), 'detail'] as const,
  detail: (id: string) => [...feedbackKeys.details(), id] as const,
} as const;



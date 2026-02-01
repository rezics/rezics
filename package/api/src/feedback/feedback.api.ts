/**
 * Feedback API client functions
 * Direct API communication layer for /feedbacks
 */

import type {
  FeedbackDTO,
  CreateFeedbackInput,
  FeedbackListResponse,
} from '@package/contract';
import type {FeedbackFilters} from './feedback.types';
import {buildQueryString} from '../utils/buildQuery';
import {apiFetch} from '../react-query/http';

/**
 * Feedback API methods
 */
export const feedbackApi = {
  /**
   * Create feedback for current authenticated user
   */
  create: async (input: CreateFeedbackInput): Promise<FeedbackDTO> => {
    return apiFetch<FeedbackDTO>('/feedbacks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Get current user's feedback list
   * GET /feedbacks/my
   */
  listMy: async (filters?: FeedbackFilters): Promise<FeedbackListResponse> => {
    return apiFetch<FeedbackListResponse>(
      `/feedbacks/my${buildQueryString(filters)}`,
    );
  },

  /**
   * List feedbacks for a specific userId (admin or self)
   * GET /feedbacks/by-user/:userId
   */
  listByUser: async (
    userId: string,
    filters?: FeedbackFilters,
  ): Promise<FeedbackListResponse> => {
    return apiFetch<FeedbackListResponse>(
      `/feedbacks/by-user/${userId}${buildQueryString(filters)}`,
    );
  },

  /**
   * Admin: list all feedbacks with filters
   * GET /feedbacks
   */
  list: async (filters?: FeedbackFilters): Promise<FeedbackListResponse> => {
    return apiFetch<FeedbackListResponse>(
      `/feedbacks${buildQueryString(filters)}`,
    );
  },

  /**
   * Admin: get a single feedback by id
   * GET /feedbacks/:id
   */
  get: async (id: string): Promise<FeedbackDTO> => {
    return apiFetch<FeedbackDTO>(`/feedbacks/${id}`);
  },

  /**
   * Admin: mark feedback as resolved / unresolved
   * PATCH /feedbacks/:id/resolve
   */
  setResolved: async (id: string, resolved: boolean): Promise<FeedbackDTO> => {
    return apiFetch<FeedbackDTO>(`/feedbacks/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({resolved}),
    });
  },
};

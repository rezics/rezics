/**
 * Feedback API client functions
 * Direct API communication layer for /feedbacks
 */

import type {
  CreateFeedbackInput,
  FeedbackDTO,
  FeedbackListResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { FeedbackFilters } from "./feedback.types";

/**
 * Feedback API methods
 */
export const feedbackApi = {
  /**
   * Create feedback for current authenticated user
   */
  create: async (input: CreateFeedbackInput): Promise<FeedbackDTO> => {
    return apiFetch<FeedbackDTO>("/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Get current user's feedback list
   * GET /feedback/my
   */
  listMy: async (filters?: FeedbackFilters): Promise<FeedbackListResponse> => {
    return apiFetch<FeedbackListResponse>(
      `/feedback/my${buildQueryString(filters)}`,
    );
  },

  /**
   * List feedbacks for a specific userId (admin or self)
   * GET /feedback/by-user/:userId
   */
  listByUser: async (
    userId: string,
    filters?: FeedbackFilters,
  ): Promise<FeedbackListResponse> => {
    return apiFetch<FeedbackListResponse>(
      `/feedback/by-user/${userId}${buildQueryString(filters)}`,
    );
  },

  /**
   * Admin: list all feedbacks with filters
   * GET /feedbacks
   */
  list: async (filters?: FeedbackFilters): Promise<FeedbackListResponse> => {
    return apiFetch<FeedbackListResponse>(
      `/feedback/list${buildQueryString(filters)}`,
    );
  },

  /**
   * Admin: get a single feedback by id
   * GET /feedback/:id
   */
  get: async (id: string): Promise<FeedbackDTO> => {
    return apiFetch<FeedbackDTO>(`/feedback/${id}`);
  },

  /**
   * Admin: mark feedback as resolved / unresolved
   * PATCH /feedback/:id/resolve
   */
  setResolved: async (id: string, resolved: boolean): Promise<FeedbackDTO> => {
    return apiFetch<FeedbackDTO>(`/feedback/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolved }),
    });
  },
};

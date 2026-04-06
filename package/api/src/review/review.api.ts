/**
 * Review API client functions
 */

import type {
  CreateReviewInput,
  ReviewListResponse,
  ReviewResponse,
  UpdateReviewInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { ReviewFilters } from "./review.types";

const shortBasePath = "/reviews/short";

export const reviewApi = {
  /**
   * List reviews with optional filters
   */
  list: async (filters?: ReviewFilters): Promise<ReviewListResponse> => {
    return apiFetch<ReviewListResponse>(`/reviews${buildQueryString(filters)}`);
  },

  /**
   * Get single review by id
   */
  get: async (id: string): Promise<ReviewResponse> => {
    return apiFetch<ReviewResponse>(`/reviews/${id}`);
  },

  /**
   * Search reviews by text query and filters
   */
  search: async (
    query: string,
    filters?: ReviewFilters,
  ): Promise<ReviewListResponse> => {
    return apiFetch<ReviewListResponse>(
      `/reviews${buildQueryString({ q: query, ...filters })}`,
    );
  },

  /**
   * Get reviews by user ID
   */
  getByUserId: async (
    userId: string,
    filters?: ReviewFilters,
  ): Promise<ReviewListResponse> => {
    return apiFetch<ReviewListResponse>(
      `/reviews${buildQueryString({ userId, ...filters })}`,
    );
  },

  /**
   * Get reviews by book ID
   */
  getByBookId: async (
    bookId: string,
    filters?: ReviewFilters,
  ): Promise<ReviewListResponse> => {
    return apiFetch<ReviewListResponse>(
      `/reviews${buildQueryString({ bookId, ...filters })}`,
    );
  },

  /**
   * Create new review
   */
  create: async (
    input: CreateReviewInput,
    unitType?: string,
  ): Promise<ReviewResponse> => {
    const suffix = unitType ? `?unitType=${unitType}` : "";
    return apiFetch<ReviewResponse>(`/reviews${suffix}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing review
   */
  update: async (
    id: string,
    input: UpdateReviewInput,
    unitType?: string,
  ): Promise<ReviewResponse> => {
    const suffix = unitType ? `?unitType=${unitType}` : "";
    return apiFetch<ReviewResponse>(`/reviews/${id}${suffix}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  /**
   * Delete review
   */
  remove: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/reviews/${id}`, {
      method: "DELETE",
    });
  },

  remark: {
    /**
     * List short reviews (UnitType.REMARK)
     */
    list: async (filters?: ReviewFilters): Promise<ReviewListResponse> => {
      return apiFetch<ReviewListResponse>(
        `${shortBasePath}${buildQueryString(filters)}`,
      );
    },
  },
};

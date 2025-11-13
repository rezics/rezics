/**
 * Reaction API client functions
 * Direct API communication layer for reaction endpoints
 */

import type {ReactionListQuery} from '@package/contract';
import {buildQueryString} from '../utils/buildQuery';
import {apiFetch} from '../react-query/http';
import type {
  ReactionDTO,
  ReactionListResponse,
  ReactionCreateInput,
  ReactionUpdateInput,
  ReactionDeleteQuery,
  ReactionSummaryResponse,
  ReactionMyResponse,
} from './reaction.types.ts';

/**
 * Reaction API methods
 */
export const reactionApi = {
  /**
   * List reactions with optional filters and pagination
   *
   * @param {ReactionListQuery} [filters] - Optional filter and pagination params
   * @returns {Promise<ReactionListResponse>} Paginated reactions and total count
   */
  list: async (filters?: ReactionListQuery): Promise<ReactionListResponse> => {
    return apiFetch<ReactionListResponse>(
      `/reactions${buildQueryString(filters)}`,
    );
  },

  /**
   * Get summary counts by reaction for a target
   *
   * @param {string} targetType - Target entity type (e.g., 'BOOK', 'COMMENT')
   * @param {string} targetId - Target entity id (UUID)
   * @returns {Promise<ReactionSummaryResponse>} Aggregated counts per reaction
   */
  summary: async (
    targetType: string,
    targetId: string,
  ): Promise<ReactionSummaryResponse> => {
    return apiFetch<ReactionSummaryResponse>(
      `/reactions/summary${buildQueryString({targetType, targetId})}`,
    );
  },

  /**
   * Get current user's reactions for a target
   * Requires a valid Authorization header to be present via apiFetch setup
   *
   * @param {string} targetType - Target entity type
   * @param {string} targetId - Target entity id (UUID)
   * @returns {Promise<ReactionMyResponse>} Current user's reactions on the target
   */
  my: async (
    targetType: string,
    targetId: string,
  ): Promise<ReactionMyResponse> => {
    return apiFetch<ReactionMyResponse>(
      `/reactions/my${buildQueryString({targetType, targetId})}`,
    );
  },

  /**
   * Create a reaction for the current user (idempotent)
   *
   * @param {ReactionCreateInput} input - Reaction creation payload
   * @returns {Promise<ReactionDTO>} The created (or existing) reaction row
   */
  create: async (input: ReactionCreateInput): Promise<ReactionDTO> => {
    return apiFetch<ReactionDTO>('/reactions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update reaction type from one to another for current user
   * When old and new are the same, backend responds with the current row
   *
   * @param {ReactionUpdateInput} input - Update payload
   * @returns {Promise<ReactionDTO>} The resulting reaction row for the new type
   */
  update: async (input: ReactionUpdateInput): Promise<ReactionDTO> => {
    return apiFetch<ReactionDTO>(`/reactions`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a reaction for the current user (idempotent)
   *
   * @param {ReactionDeleteQuery} query - Target and reaction to remove
   * @returns {Promise<{deleted: boolean}>} Whether a row was actually deleted
   */
  remove: async (query: ReactionDeleteQuery): Promise<{deleted: boolean}> => {
    return apiFetch<{deleted: boolean}>(
      `/reactions${buildQueryString(query)}`,
      {method: 'DELETE'},
    );
  },
};

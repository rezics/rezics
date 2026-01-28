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
  ReactionMultiSummaryResponse,
  ReactionCreateInput,
  ReactionUpdateInput,
  ReactionDeleteQuery,
  ReactionSummaryResponse,
  ReactionMyResponse,
  BookmarkTagsResponse,
  BookmarkTagsUpdateInput,
  ReactionSummary,
} from './reaction.types.ts';

function transformReactionSummaryResponse(response: {
  targetIds: string[];
  summaries: ReactionSummary[];
}): ReactionMultiSummaryResponse {
  const summaries: Record<string, Record<string, number>> = {};
  response.summaries.forEach(summary => {
    if (!summaries[summary.targetId]) {
      summaries[summary.targetId] = {};
    }
    summaries[summary.targetId][summary.reaction] = summary.count;
  });
  return {
    targetIds: response.targetIds,
    summaries,
  };
}

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
   * @param {string} targetId - Target entity id (UUID)
   * @returns {Promise<ReactionSummaryResponse>} Aggregated counts per reaction
   */
  summary: async (targetId: string): Promise<ReactionSummaryResponse> => {
    return apiFetch<ReactionSummaryResponse>(
      `/reactions/summary${buildQueryString({targetId})}`,
    );
  },

  /**
   * Get summary counts by reaction for many targets
   *
   * @param {string[]} targetIds - Array of target entity ids (UUID)
   * @returns {Promise<ReactionMultiSummaryResponse>} Aggregated counts per reaction, keyed by targetId
   */
  summaryBatch: async (
    targetIds: string[],
  ): Promise<ReactionMultiSummaryResponse> => {
    const qs = new URLSearchParams();
    targetIds.forEach(id => qs.append('targetIds', id));
    const queryString = qs.toString();
    const response = await apiFetch<{
      targetIds: string[];
      summaries: ReactionSummary[];
    }>(`/reactions/summary${queryString ? `?${queryString}` : ''}`);
    return transformReactionSummaryResponse(response);
  },

  /**
   * Get current user's reactions for one or many targets
   * Requires a valid Authorization header to be present via apiFetch setup
   *
   * - Single-target usage:
   *    reactionApi.my({ targetId })
   * - Multi-target usage:
   *    reactionApi.my({ targetIds: [...] })
   *
   * @param params - Either { targetId } or { targetIds }
   * @returns {Promise<ReactionMyResponse>} Aggregated reactions keyed by targetId
   */
  my: async (params: {
    targetId?: string;
    targetIds?: string[];
  }): Promise<ReactionMyResponse> => {
    return apiFetch<ReactionMyResponse>(
      `/reactions/my${buildQueryString(params)}`,
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

  /**
   * Get current user's bookmark tags for a given target.
   *
   * @param {string} targetId - Unit id of the bookmarked target
   */
  getBookmarkTags: async (targetId: string): Promise<BookmarkTagsResponse> => {
    return apiFetch<BookmarkTagsResponse>(`/reactions/bookmarks/${targetId}`);
  },

  /**
   * Set (replace) current user's bookmark tags for a given target.
   * This will also ensure the 'bookmark' reaction exists.
   *
   * @param {BookmarkTagsUpdateInput} input - targetId + new tags
   */
  setBookmarkTags: async (
    input: BookmarkTagsUpdateInput,
  ): Promise<BookmarkTagsResponse> => {
    const {targetId, tags} = input;
    return apiFetch<BookmarkTagsResponse>(`/reactions/bookmarks/${targetId}`, {
      method: 'PUT',
      body: JSON.stringify({tags}),
    });
  },
};

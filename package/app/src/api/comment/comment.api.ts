/**
 * Comment API client functions
 * Mirrors the structure used in `book.api.ts` for consistency.
 *
 * Backend endpoints (see server `commentApi`):
 * GET    /comments?rootUnitId=...&parentId=...&maxDepth&start&limit&order
 * GET    /comments/:unitId
 * POST   /comments
 * PUT    /comments/:unitId
 * DELETE /comments/:unitId
 *
 * Notes:
 * - The backend path parameter is called `unitId`; the returned DTO contains `id`.
 *   We assume `id` corresponds to that `unitId` for cache keying.
 * - Creation uses `rootPostId` (contract naming) which maps to comment tree root.
 */

import type {
  CommentDTO,
  CreateCommentInput,
  UpdateCommentInput,
  CommentTreeQuery,
  CommentTreeResponse,
} from '@package/contract';
import type {CommentListFilters} from './comment';
import {buildQueryString} from '../utils/buildQuery';
import {apiFetch} from '../react-query/http';

/**
 * Comment API methods
 */
export const commentApi = {
  /**
   * Get comment tree slice for a unit
   */
  getCommentTree: async (
    unitId: string,
    params?: CommentTreeQuery,
  ): Promise<CommentTreeResponse> => {
    return apiFetch<CommentTreeResponse>(
      `/comments/comment-tree/${unitId}/${buildQueryString(params)}`,
    );
  },
  /**
   * List a flat slice of comments.
   * Required: `rootUnitId` identifies the comment tree root (Unit id of the post/entity).
   * Optional: `parentId` to list direct children of a comment, pagination & sort fields.
   * @param filters Comment list filters including `rootUnitId` (required)
   * @returns Object containing the rootUnitId and comment items array
   */
  list: async (
    filters: CommentListFilters,
  ): Promise<{rootUnitId: string; items: CommentDTO[]}> => {
    return apiFetch<{rootUnitId: string; items: CommentDTO[]}>(
      `/comments${buildQueryString(filters)}`,
    );
  },

  /**
   * Get a single comment by its unit id
   * @param unitId Comment Unit identifier (assumed to be returned as `id`)
   * @returns CommentDTO
   */
  get: async (unitId: string): Promise<CommentDTO> => {
    return apiFetch<CommentDTO>(`/comments/${unitId}`);
  },

  /**
   * Create a new comment
   * @param input CreateCommentInput (rootPostId, optional parentCommentId, content)
   * @returns Newly created CommentDTO
   */
  create: async (input: CreateCommentInput): Promise<CommentDTO> => {
    return apiFetch<CommentDTO>('/comments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an existing comment's content
   * @param unitId Unit id of the comment to update
   * @param input UpdateCommentInput (content)
   * @returns Updated CommentDTO
   */
  update: async (
    unitId: string,
    input: UpdateCommentInput,
  ): Promise<CommentDTO> => {
    return apiFetch<CommentDTO>(`/comments/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a comment by unit id
   * @param unitId Comment Unit identifier
   * @returns Status message
   */
  remove: async (unitId: string): Promise<{message: string}> => {
    return apiFetch<{message: string}>(`/comments/${unitId}`, {
      method: 'DELETE',
    });
  },
};

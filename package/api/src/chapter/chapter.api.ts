/**
 * Chapter API client functions
 * Direct API communication layer
 */

import type {
  CreateChapterInput,
  UpdateChapterInput,
  ChapterListResponse,
  ChapterResponse,
} from '@rezics/contract';
import type {ChapterFilters} from './chapter.types.ts';
import {buildQueryString} from '../utils/buildQuery';

import {apiFetch} from '../react-query/http';

/**
 * Chapter API methods
 */
export const chapterApi = {
  /**
   * List chapters with optional filters
   */
  list: async (filters?: ChapterFilters): Promise<ChapterListResponse> => {
    return apiFetch<ChapterListResponse>(
      `/chapters${buildQueryString(filters)}`,
    );
  },

  /**
   * Get single chapter by unitId
   */
  get: async (unitId: string): Promise<ChapterResponse> => {
    return apiFetch<ChapterResponse>(`/chapters/${unitId}`);
  },

  /**
   * Search chapters by query and filters
   */
  search: async (
    query: string,
    filters?: ChapterFilters,
  ): Promise<ChapterListResponse> => {
    return apiFetch<ChapterListResponse>(
      `/chapters${buildQueryString({q: query, ...filters})}`,
    );
  },

  /**
   * Get chapters by user ID
   */
  getByUserId: async (
    userId: string,
    filters?: ChapterFilters,
  ): Promise<ChapterListResponse> => {
    return apiFetch<ChapterListResponse>(
      `/chapters${buildQueryString({userId, ...filters})}`,
    );
  },

  /**
   * Get chapters by target unit (e.g., book or parent chapter)
   */
  getByTargetUnitId: async (
    targetUnitId: string,
    filters?: ChapterFilters,
  ): Promise<ChapterListResponse> => {
    return apiFetch<ChapterListResponse>(
      `/chapters${buildQueryString({targetUnitId, ...filters})}`,
    );
  },

  /**
   * Create new chapter
   */
  create: async (input: CreateChapterInput): Promise<ChapterResponse> => {
    return apiFetch<ChapterResponse>('/chapters', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing chapter
   */
  update: async (
    unitId: string,
    input: UpdateChapterInput,
  ): Promise<ChapterResponse> => {
    return apiFetch<ChapterResponse>(`/chapters/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete chapter
   */
  remove: async (unitId: string): Promise<{message: string}> => {
    return apiFetch<{message: string}>(`/chapters/${unitId}`, {
      method: 'DELETE',
    });
  },
};

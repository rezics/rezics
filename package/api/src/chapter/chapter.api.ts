/**
 * Chapter API client functions
 * Direct API communication layer
 */

import type {
  ChapterMaterializationRequest,
  ChapterMaterializationResponse,
  ChapterListResponse,
  ChapterResponse,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { ChapterFilters } from "./chapter.types.ts";

/**
 * Chapter API methods
 */
export const chapterApi = {
  /**
   * List chapters with optional filters
   */
  list: async (filters?: ChapterFilters): Promise<ChapterListResponse> => {
    return apiFetch<ChapterListResponse>(
      `/chapter/list${buildQueryString(filters)}`,
    );
  },

  /**
   * Get single chapter by unitId
   */
  get: async (unitId: string): Promise<ChapterResponse> => {
    return apiFetch<ChapterResponse>(`/chapter/${unitId}`);
  },

  /**
   * Materialize a chapter Unit for a BookIndex path, or return the existing one.
   */
  materializeByBookPath: async (
    bookUnitId: string,
    input: ChapterMaterializationRequest,
  ): Promise<ChapterMaterializationResponse> => {
    return apiFetch<ChapterMaterializationResponse>(
      `/chapter/materialize/book/${bookUnitId}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Search chapters by query and filters
   */
  search: async (
    query: string,
    filters?: ChapterFilters,
  ): Promise<ChapterListResponse> => {
    return apiFetch<ChapterListResponse>(
      `/chapter/list${buildQueryString({ q: query, ...filters })}`,
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
      `/chapter/list${buildQueryString({ userId, ...filters })}`,
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
      `/chapter/list${buildQueryString({ targetUnitId, ...filters })}`,
    );
  },

  /**
   * Create new chapter
   */
  create: async (input: CreateChapterInput): Promise<ChapterResponse> => {
    return apiFetch<ChapterResponse>("/chapter", {
      method: "POST",
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
    return apiFetch<ChapterResponse>(`/chapter/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete chapter
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/chapter/${unitId}`, {
      method: "DELETE",
    });
  },
};

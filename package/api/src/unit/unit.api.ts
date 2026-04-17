/**
 * Unit API client functions
 * Direct API communication layer
 */

import type {
  CreateUnitInput,
  UnitListResponse,
  UnitResponse,
  UnitTranslationDTO,
  UpdateTranslationInput,
  UpdateUnitInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { UnitFilters } from "./unit.types";

/**
 * Unit API methods
 */
export const unitApi = {
  /**
   * List units with optional filters
   * Supports: q, type, types, excludeTypes, status, statuses, visibility,
   * userId, userIds, workUnitId, language, nsfw, date ranges, sort, pagination
   */
  list: async (filters?: UnitFilters): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(`/unit/list${buildQueryString(filters)}`);
  },

  /**
   * Search units by query and optional filters
   */
  search: async (
    query: string,
    filters?: UnitFilters,
  ): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(
      `/unit/list${buildQueryString({ q: query, ...filters })}`,
    );
  },

  /**
   * Get units by user ID
   */
  getByUserId: async (
    userId: string,
    filters?: UnitFilters,
  ): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(
      `/unit/list${buildQueryString({ userId, ...filters })}`,
    );
  },

  /**
   * Get single unit by id
   */
  get: async (unitId: string): Promise<UnitResponse> => {
    return apiFetch<UnitResponse>(`/unit/${unitId}`);
  },

  /**
   * Get single unit by slug
   */
  getBySlug: async (slug: string): Promise<UnitResponse> => {
    return apiFetch<UnitResponse>(`/unit/by-slug/${slug}`);
  },

  /**
   * Set slug on a unit (TAG or REALM only)
   */
  setSlug: async (
    unitId: string,
    slug: string,
  ): Promise<UnitResponse> => {
    return apiFetch<UnitResponse>(`/unit/${unitId}/slug`, {
      method: "PUT",
      body: JSON.stringify({ slug }),
    });
  },

  /**
   * Create new unit
   */
  create: async (input: CreateUnitInput): Promise<UnitResponse> => {
    return apiFetch<UnitResponse>("/unit", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing unit
   */
  update: async (
    unitId: string,
    input: UpdateUnitInput,
  ): Promise<UnitResponse> => {
    return apiFetch<UnitResponse>(`/unit/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete unit
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/unit/${unitId}`, {
      method: "DELETE",
    });
  },

  /**
   * Upsert a translation for a unit by language
   */
  upsertTranslation: async (
    unitId: string,
    language: string,
    input: UpdateTranslationInput,
  ): Promise<UnitTranslationDTO> => {
    return apiFetch<UnitTranslationDTO>(
      `/unit/${unitId}/translations/${language}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },
};

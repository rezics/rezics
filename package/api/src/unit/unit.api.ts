/**
 * Unit API client functions
 * Direct API communication layer
 */

import type {
  CreateUnitInput,
  UnitListResponse,
  UnitResponse,
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
   */
  list: async (filters?: UnitFilters): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(`/units${buildQueryString(filters)}`);
  },

  /**
   * Search units by query and optional filters
   */
  search: async (
    query: string,
    filters?: UnitFilters,
  ): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(
      `/units${buildQueryString({ q: query, ...filters })}`,
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
      `/units${buildQueryString({ userId, ...filters })}`,
    );
  },

  /**
   * Get single unit by id
   */
  get: async (unitId: string): Promise<UnitResponse> => {
    return apiFetch<UnitResponse>(`/units/${unitId}`);
  },

  /**
   * Create new unit
   */
  create: async (input: CreateUnitInput): Promise<UnitResponse> => {
    return apiFetch<UnitResponse>("/units", {
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
    return apiFetch<UnitResponse>(`/units/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete unit
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/units/${unitId}`, {
      method: "DELETE",
    });
  },
};

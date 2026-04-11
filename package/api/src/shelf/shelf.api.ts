/**
 * Shelf API client functions
 * Direct API communication layer
 *
 * Shelf replaces Readlist. Includes item management sub-endpoints.
 */

import type {
  AddShelfItemInput,
  CreateShelfInput,
  ShelfItemDTO,
  ShelfListResponse,
  ShelfResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { ShelfFilters } from "./shelf.types";

/**
 * Shelf API methods
 */
export const shelfApi = {
  /**
   * List shelves with optional filters
   * Supports: userId, kindKey, containsItemUnitId, language, sort, start, cursor, limit
   */
  list: async (filters?: ShelfFilters): Promise<ShelfListResponse> => {
    return apiFetch<ShelfListResponse>(`/shelves${buildQueryString(filters)}`);
  },

  /**
   * Get single shelf by unitId
   */
  get: async (unitId: string): Promise<ShelfResponse> => {
    return apiFetch<ShelfResponse>(`/shelves/${unitId}`);
  },

  /**
   * Get shelves by user ID
   */
  getByUserId: async (
    userId: string,
    filters?: ShelfFilters,
  ): Promise<ShelfListResponse> => {
    return apiFetch<ShelfListResponse>(
      `/shelves${buildQueryString({ userId, ...filters })}`,
    );
  },

  /**
   * Create new shelf
   */
  create: async (input: CreateShelfInput): Promise<ShelfResponse> => {
    return apiFetch<ShelfResponse>("/shelves", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing shelf
   */
  update: async (
    unitId: string,
    input: UpdateShelfInput,
  ): Promise<ShelfResponse> => {
    return apiFetch<ShelfResponse>(`/shelves/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete shelf
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/shelves/${unitId}`, {
      method: "DELETE",
    });
  },

  // ---- Shelf Item management ----

  /**
   * Add an item to a shelf
   */
  addItem: async (
    shelfUnitId: string,
    input: AddShelfItemInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(`/shelves/${shelfUnitId}/items`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an item within a shelf
   */
  updateItem: async (
    shelfUnitId: string,
    itemUnitId: string,
    input: UpdateShelfItemInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(
      `/shelves/${shelfUnitId}/items/${itemUnitId}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Remove an item from a shelf
   */
  removeItem: async (
    shelfUnitId: string,
    itemUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelves/${shelfUnitId}/items/${itemUnitId}`,
      {
        method: "DELETE",
      },
    );
  },
};

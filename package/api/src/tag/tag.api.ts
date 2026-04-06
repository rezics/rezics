import type {
  CreateTagInput,
  TagDetailDTO,
  TagDTO,
  UpdateTagInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { TagFilters } from "./tag.types";

/**
 * Tag API methods
 */
export const tagApi = {
  /**
   * List tags with optional filters (supports domainId and objectId filters)
   */
  list: async (
    filters?: TagFilters,
  ): Promise<{ tags: TagDTO[]; total: number }> => {
    return apiFetch<{ tags: TagDTO[]; total: number }>(
      `/tags${buildQueryString(filters)}`,
    );
  },

  /**
   * Get tag detail by unitId
   */
  get: async (unitId: string): Promise<TagDetailDTO> => {
    return apiFetch<TagDetailDTO>(`/tags/${unitId}`);
  },

  /**
   * Get tag by name within a domain (returns null if not found)
   */
  getByName: async (
    name: string,
    type?: string | null,
    domainId?: string,
  ): Promise<TagDetailDTO | null> => {
    const qs = buildQueryString({ name, type: type ?? undefined, domainId });
    return apiFetch<TagDetailDTO | null>(`/tags/by-name${qs}`);
  },

  /**
   * Create a tag (requires auth)
   */
  create: async (input: CreateTagInput): Promise<TagDetailDTO> => {
    return apiFetch<TagDetailDTO>(`/tags`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update a tag
   */
  update: async (
    unitId: string,
    input: UpdateTagInput,
  ): Promise<TagDetailDTO> => {
    return apiFetch<TagDetailDTO>(`/tags/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a tag
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/tags/${unitId}`, {
      method: "DELETE",
    });
  },

  /**
   * Attach tag (unitId) to a target unit
   */
  attach: async (
    unitId: string,
    targetUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/tags/${unitId}/attach`, {
      method: "POST",
      body: JSON.stringify({ targetUnitId }),
    });
  },

  /**
   * Detach tag (unitId) from a target unit
   */
  detach: async (
    unitId: string,
    targetUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/tags/${unitId}/detach`, {
      method: "POST",
      body: JSON.stringify({ targetUnitId }),
    });
  },
};

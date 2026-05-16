import type {
  CreateEntityInput,
  EntityDTO,
  EntityListQuery,
  EntityListResponse,
  UpdateEntityInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const entityApi = {
  list: async (query?: EntityListQuery): Promise<EntityListResponse> => {
    return apiFetch<EntityListResponse>(`/entity${buildQueryString(query)}`);
  },

  get: async (unitId: string): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/entity/${unitId}`);
  },

  getBySlug: async (slug: string): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/entity/by-slug/${encodeURIComponent(slug)}`);
  },

  create: async (input: CreateEntityInput): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/entity`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    unitId: string,
    input: UpdateEntityInput,
  ): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/entity/${unitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/entity/${unitId}`, {
      method: "DELETE",
    });
  },
};

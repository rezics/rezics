import type {
  AttributionDTO,
  CreateEntityInput,
  EntityDTO,
  EntityListQuery,
  LinkAttributionInput,
  UpdateEntityInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const attributionApi = {
  // ---- Entities ----

  listEntities: async (
    query?: EntityListQuery,
  ): Promise<{ entities: EntityDTO[]; total: number }> => {
    return apiFetch<{ entities: EntityDTO[]; total: number }>(
      `/attribution/entities${buildQueryString(query)}`,
    );
  },

  getEntity: async (id: string): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/attribution/entities/${id}`);
  },

  createEntity: async (input: CreateEntityInput): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>("/attribution/entities", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateEntity: async (
    id: string,
    input: UpdateEntityInput,
  ): Promise<EntityDTO> => {
    return apiFetch<EntityDTO>(`/attribution/entities/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteEntity: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/attribution/entities/${id}`, {
      method: "DELETE",
    });
  },

  // ---- Credits ----

  linkAttribution: async (
    input: LinkAttributionInput,
  ): Promise<AttributionDTO> => {
    return apiFetch<AttributionDTO>("/attribution/credits", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  unlinkAttribution: async (
    unitId: string,
    entityId: string,
    role: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/attribution/credits/${unitId}/${entityId}/${role}`,
      { method: "DELETE" },
    );
  },
};

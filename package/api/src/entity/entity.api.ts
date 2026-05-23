import type {
  CreateEntityInput,
  CreationMode,
  EditorialPatchSubmission,
  EntityDTO,
  EntityListQuery,
  EntityListResponse,
  EntitySearchOptions,
  EntitySearchResult,
} from "@rezics/contract";
import { CreationMode as CreationModeValue } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const entityApi = {
  list: async (query?: EntityListQuery): Promise<EntityListResponse> => {
    return apiFetch<EntityListResponse>(`/entity${buildQueryString(query)}`);
  },

  search: async (
    options?: EntitySearchOptions,
  ): Promise<EntitySearchResult> => {
    return apiFetch<EntitySearchResult>("/meili/entities/search", {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
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

  createWithMode: async (
    input: Omit<CreateEntityInput, "creationMode">,
    creationMode: CreationMode,
  ): Promise<EntityDTO> => {
    return entityApi.create({ ...input, creationMode });
  },

  createWiki: async (
    input: Omit<CreateEntityInput, "creationMode">,
  ): Promise<EntityDTO> => {
    return entityApi.createWithMode(input, CreationModeValue.WIKI);
  },

  createPersonal: async (
    input: Omit<CreateEntityInput, "creationMode">,
  ): Promise<EntityDTO> => {
    return entityApi.createWithMode(input, CreationModeValue.PERSONAL);
  },

  update: async (
    unitId: string,
    input: EditorialPatchSubmission,
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

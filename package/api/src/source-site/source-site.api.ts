import type {
  CreateSourceSiteInput,
  SourceSiteDTO,
  SourceSiteListQuery,
  SourceSiteListResponse,
  UpdateSourceSiteInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const sourceSiteApi = {
  list: async (
    query?: SourceSiteListQuery,
  ): Promise<SourceSiteListResponse> => {
    return apiFetch<SourceSiteListResponse>(
      `/source-site${buildQueryString(query)}`,
    );
  },

  get: async (entityUnitId: string): Promise<SourceSiteDTO> => {
    return apiFetch<SourceSiteDTO>(`/source-site/${entityUnitId}`);
  },

  create: async (input: CreateSourceSiteInput): Promise<SourceSiteDTO> => {
    return apiFetch<SourceSiteDTO>("/source-site", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    entityUnitId: string,
    input: UpdateSourceSiteInput,
  ): Promise<SourceSiteDTO> => {
    return apiFetch<SourceSiteDTO>(`/source-site/${entityUnitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove: async (entityUnitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/source-site/${entityUnitId}`, {
      method: "DELETE",
    });
  },
};

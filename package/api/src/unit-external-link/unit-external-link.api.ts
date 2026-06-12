import type {
  CreateUnitExternalLinkInput,
  UnitExternalLinkDTO,
  UnitExternalLinkListQuery,
  UnitExternalLinkListResponse,
  UnitExternalLinksBatchBody,
  UnitExternalLinksBatchResponse,
  UnitExternalLinksResponse,
  UpdateUnitExternalLinkInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const unitExternalLinkApi = {
  list: async (
    query?: UnitExternalLinkListQuery,
  ): Promise<UnitExternalLinkListResponse> => {
    return apiFetch<UnitExternalLinkListResponse>(
      `/unit-external-link${buildQueryString(query)}`,
    );
  },

  links: async (
    unitId: string,
    sourceEntityUnitId?: string,
  ): Promise<UnitExternalLinksResponse> => {
    return apiFetch<UnitExternalLinksResponse>(
      `/unit-external-link/unit/${unitId}/links${buildQueryString({
        sourceEntityUnitId,
      })}`,
    );
  },

  linksBatch: async (
    input: UnitExternalLinksBatchBody,
  ): Promise<UnitExternalLinksBatchResponse> => {
    return apiFetch<UnitExternalLinksBatchResponse>(
      "/unit-external-link/units/links/batch",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  create: async (
    input: CreateUnitExternalLinkInput,
  ): Promise<UnitExternalLinkDTO> => {
    return apiFetch<UnitExternalLinkDTO>("/unit-external-link", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    id: string,
    input: UpdateUnitExternalLinkInput,
  ): Promise<UnitExternalLinkDTO> => {
    return apiFetch<UnitExternalLinkDTO>(`/unit-external-link/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/unit-external-link/${id}`, {
      method: "DELETE",
    });
  },
};

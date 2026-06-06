import type {
  CreateUnitExternalRefInput,
  ParsedUnitExternalRefUrl,
  ParseUnitExternalRefUrlInput,
  UnitExternalRefDTO,
  UnitExternalRefListQuery,
  UnitExternalRefListResponse,
  UpdateUnitExternalRefInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const unitExternalRefApi = {
  list: async (
    query?: UnitExternalRefListQuery,
  ): Promise<UnitExternalRefListResponse> => {
    return apiFetch<UnitExternalRefListResponse>(
      `/unit-external-ref${buildQueryString(query)}`,
    );
  },

  parseUrl: async (
    input: ParseUnitExternalRefUrlInput,
  ): Promise<ParsedUnitExternalRefUrl> => {
    return apiFetch<ParsedUnitExternalRefUrl>("/unit-external-ref/parse-url", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  create: async (
    input: CreateUnitExternalRefInput,
  ): Promise<UnitExternalRefDTO> => {
    return apiFetch<UnitExternalRefDTO>("/unit-external-ref", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    id: string,
    input: UpdateUnitExternalRefInput,
  ): Promise<UnitExternalRefDTO> => {
    return apiFetch<UnitExternalRefDTO>(`/unit-external-ref/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/unit-external-ref/${id}`, {
      method: "DELETE",
    });
  },
};

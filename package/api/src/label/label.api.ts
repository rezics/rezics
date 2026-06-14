import type { CreateLabelInput, LabelDTO } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

type LabelSearchResponse = {
  items: LabelDTO[];
};

export const labelApi = {
  search: async (q: string, limit?: number): Promise<LabelDTO[]> => {
    const qs = buildQueryString({ q, limit });
    const response = await apiFetch<LabelSearchResponse>(`/label/search${qs}`);
    return response.items;
  },

  create: async (input: CreateLabelInput): Promise<LabelDTO> => {
    return apiFetch<LabelDTO>("/label/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

import type {
  CreateLabelInput,
  LabelDTO,
  LabelListResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const labelApi = {
  list: async (ids: string[]): Promise<LabelListResponse> => {
    if (ids.length === 0) return { labels: [] };
    return apiFetch<LabelListResponse>(`/label/list?ids=${ids.join(",")}`);
  },
  create: async (input: CreateLabelInput): Promise<LabelDTO> => {
    return apiFetch<LabelDTO>("/label/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

import type { CreateLinkInput, LinkDTO, UpdateLinkInput } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const linkApi = {
  create: async (input: CreateLinkInput): Promise<LinkDTO> => {
    return apiFetch<LinkDTO>("/link", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  get: async (unitId: string): Promise<LinkDTO> => {
    return apiFetch<LinkDTO>(`/link/${unitId}`);
  },

  update: async (unitId: string, input: UpdateLinkInput): Promise<LinkDTO> => {
    return apiFetch<LinkDTO>(`/link/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/link/${unitId}`, {
      method: "DELETE",
    });
  },
};

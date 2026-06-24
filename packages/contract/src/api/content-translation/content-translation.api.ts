import type {
  ContentTranslationListResponse,
  ContentTranslationResponse,
  UpsertContentTranslationInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const contentTranslationApi = {
  list: async (unitId: string): Promise<ContentTranslationListResponse> => {
    return apiFetch<ContentTranslationListResponse>(
      `/content-translation/${unitId}`,
    );
  },

  get: async (
    unitId: string,
    language: string,
  ): Promise<ContentTranslationResponse> => {
    return apiFetch<ContentTranslationResponse>(
      `/content-translation/${unitId}/${language}`,
    );
  },

  upsert: async (
    unitId: string,
    language: string,
    input: Omit<UpsertContentTranslationInput, "unitId" | "language">,
  ): Promise<ContentTranslationResponse> => {
    return apiFetch<ContentTranslationResponse>(
      `/content-translation/${unitId}/${language}`,
      {
        method: "PUT",
        body: JSON.stringify({ ...input, unitId, language }),
      },
    );
  },

  delete: async (
    unitId: string,
    language: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/content-translation/${unitId}/${language}`,
      { method: "DELETE" },
    );
  },
};

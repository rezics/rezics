import type {
  ContentTranslationResponse,
  UpsertContentTranslationInput,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { contentTranslationApi } from "./content-translation.api";

export type UpsertContentTranslationVariables = {
  unitId: string;
  language: string;
  input: Omit<UpsertContentTranslationInput, "unitId" | "language">;
};

export function useUpsertContentTranslationMutation(
  options?: UseMutationOptions<
    ContentTranslationResponse,
    Error,
    UpsertContentTranslationVariables
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, language, input }) =>
      contentTranslationApi.upsert(unitId, language, input),
    ...options,
  });
}

export function useDeleteContentTranslationMutation(
  options?: UseMutationOptions<
    { message: string },
    Error,
    { unitId: string; language: string }
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, language }) =>
      contentTranslationApi.delete(unitId, language),
    ...options,
  });
}

export const contentTranslationMutations = {
  useUpsert: useUpsertContentTranslationMutation,
  useDelete: useDeleteContentTranslationMutation,
};

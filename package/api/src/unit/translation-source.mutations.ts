import type {
  TranslationSourceBody,
  TranslationSourceResponse,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { translationSourceApi } from "./translation-source.api";
import { unitKeys } from "./unit.keys";

export function useSetTranslationSourceMutation(
  options?: Omit<
    UseMutationOptions<
      TranslationSourceResponse,
      Error,
      { workId: string; lang: string; body: TranslationSourceBody }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, lang, body }) =>
      translationSourceApi.patch(workId, lang, body),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(variables.workId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const translationSourceMutations = {
  useSet: useSetTranslationSourceMutation,
};

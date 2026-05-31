import type {
  TranslationSourceBody,
  TranslationSourceResponse,
} from "@rezics/contract";
import {
  type QueryKey,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { patchTranslationDetailQueries } from "../react-query/cache-coherence";
import { translationSourceApi } from "./translation-source.api";
import { unitKeys } from "./unit.keys";

type SetTranslationSourceVariables = {
  unitId: string;
  lang: string;
  body: TranslationSourceBody;
};

type SetTranslationSourceMutationOptions = Omit<
  UseMutationOptions<
    TranslationSourceResponse,
    Error,
    SetTranslationSourceVariables
  >,
  "mutationFn"
> & {
  affectedDetailKeys?: (
    variables: SetTranslationSourceVariables,
    data: TranslationSourceResponse,
  ) => readonly QueryKey[];
};

export function useSetTranslationSourceMutation(
  options?: SetTranslationSourceMutationOptions,
) {
  const queryClient = useQueryClient();
  const { affectedDetailKeys, ...mutationOptions } = options ?? {};

  return useMutation({
    mutationFn: ({ unitId, lang, body }) =>
      translationSourceApi.patch(unitId, lang, body),
    ...mutationOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await patchTranslationDetailQueries({
        queryClient,
        detailKeys: affectedDetailKeys?.(variables, data) ?? [],
        translation: data,
      });
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(variables.unitId),
      });
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const translationSourceMutations = {
  useSet: useSetTranslationSourceMutation,
};

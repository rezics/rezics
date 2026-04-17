import type {
  AttachTranslationInput,
  AttachTranslationResponse,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { translationGroupApi } from "./translation-group.api";
import { translationGroupKeys } from "./translation-group.keys";

export function useAttachTranslation(
  options?: Omit<
    UseMutationOptions<
      AttachTranslationResponse,
      Error,
      { unitId: string; input: AttachTranslationInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) =>
      translationGroupApi.attach(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: translationGroupKeys.siblings(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: translationGroupKeys.siblings(data.newUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDetachTranslation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => translationGroupApi.detach(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: translationGroupKeys.siblings(unitId),
      });
      queryClient.invalidateQueries({
        queryKey: translationGroupKeys.siblingsLists(),
      });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

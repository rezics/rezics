import type {
  NodeCompletionToggleBody,
  UnitProgressRowDTO,
  UnitProgressUpsertBody,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { progressApi } from "./progress.api";
import { progressKeys } from "./progress.keys";

export function useUpdateUnitProgress(
  unitId: string,
  options?: Omit<
    UseMutationOptions<UnitProgressRowDTO, Error, UnitProgressUpsertBody>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UnitProgressUpsertBody) =>
      progressApi.updateUnitProgress(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(progressKeys.unit(unitId), data);
      queryClient.invalidateQueries({ queryKey: progressKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteUnitProgress(
  unitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, void>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => progressApi.deleteUnitProgress(unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(progressKeys.unit(unitId), null);
      queryClient.invalidateQueries({ queryKey: progressKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useToggleNodeCompletion(
  unitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, NodeCompletionToggleBody>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NodeCompletionToggleBody) =>
      progressApi.toggleNodeCompletion(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: progressKeys.unit(unitId) });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const progressMutations = {
  useUpdateUnitProgress,
  useDeleteUnitProgress,
  useToggleNodeCompletion,
};

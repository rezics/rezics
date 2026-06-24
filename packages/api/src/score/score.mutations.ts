import type { ScoreEntryDTO, UpsertScoreInput } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { scoreApi } from "./score.api";
import { scoreKeys } from "./score.keys";

export function useUpsertScoreMutation(
  options?: Omit<
    UseMutationOptions<ScoreEntryDTO, Error, UpsertScoreInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertScoreInput) => scoreApi.upsertScore(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: scoreKeys.aggregatesByUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: scoreKeys.aggregate(variables.unitId, variables.realm),
      });
      queryClient.invalidateQueries({
        queryKey: scoreKeys.userScores(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteScoreMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { id: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => scoreApi.deleteScore(id),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: scoreKeys.aggregatesByUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: scoreKeys.userScores(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const scoreMutations = {
  useUpsertScore: useUpsertScoreMutation,
  useDeleteScore: useDeleteScoreMutation,
};

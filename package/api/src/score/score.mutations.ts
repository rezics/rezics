import type { ScoreEntryDTO, UpsertScoreInput } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { scoreApi } from "./score.api";
import { scoreKeys } from "./score.keys";

// ponytail: root prefix invalidates all score queries; per-unit granularity if perf matters
const invalidates = [scoreKeys.all()];

export function useUpsertScoreMutation(
  options?: Omit<
    UseMutationOptions<ScoreEntryDTO, Error, UpsertScoreInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: UpsertScoreInput) => scoreApi.upsertScore(input),
    ...options,
    meta: { invalidates },
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
  return useMutation({
    mutationFn: ({ id }) => scoreApi.deleteScore(id),
    ...options,
    meta: { invalidates },
  });
}

export const scoreMutations = {
  useUpsertScore: useUpsertScoreMutation,
  useDeleteScore: useDeleteScoreMutation,
};

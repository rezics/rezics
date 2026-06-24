import type {
  EntityAttributionBatchRequest,
  EntityAttributionBatchResponse,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { bookKeys } from "../book/book.keys";
import { creditAttributionKeys } from "../credit-attribution/credit-attribution.keys";
import { subjectAttributionKeys } from "../subject-attribution/subject-attribution.keys";
import { entityAttributionApi } from "./entity-attribution.api";
import { entityAttributionKeys } from "./entity-attribution.keys";

export type EntityAttributionBatchMutationInput = {
  unitId: string;
  request: EntityAttributionBatchRequest;
};

export function invalidateEntityAttributionBatchQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "invalidateQueries">,
  unitId: string,
): void {
  queryClient.invalidateQueries({
    queryKey: creditAttributionKeys.byUnit(unitId),
  });
  queryClient.invalidateQueries({
    queryKey: subjectAttributionKeys.byUnit(unitId),
  });
  queryClient.invalidateQueries({
    queryKey: entityAttributionKeys.editor(unitId),
  });
  queryClient.invalidateQueries({
    queryKey: bookKeys.detail(unitId),
  });
}

export function useEntityAttributionBatchMutation(
  options?: Omit<
    UseMutationOptions<
      EntityAttributionBatchResponse,
      Error,
      EntityAttributionBatchMutationInput
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, request }) =>
      entityAttributionApi.batchUpdate(unitId, request),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateEntityAttributionBatchQueries(queryClient, variables.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const entityAttributionMutations = {
  useBatch: useEntityAttributionBatchMutation,
};

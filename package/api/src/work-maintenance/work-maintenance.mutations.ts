import type {
  UpsertWorkMaintenanceTranslationInput,
  WorkMaintenanceDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { workMaintenanceApi } from "./work-maintenance.api";
import { workMaintenanceKeys } from "./work-maintenance.keys";

export function useUpsertWorkMaintenanceTranslationMutation(
  options?: Omit<
    UseMutationOptions<
      WorkMaintenanceDTO,
      Error,
      { unitId: string; input: UpsertWorkMaintenanceTranslationInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) =>
      workMaintenanceApi.upsertTranslation(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: workMaintenanceKeys.detail(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const workMaintenanceMutations = {
  useUpsertTranslation: useUpsertWorkMaintenanceTranslationMutation,
};

import type { CreateLabelInput, LabelDTO } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { labelApi } from "./label.api";
import { labelKeys } from "./label.keys";

export function useCreateLabel(
  options?: Omit<
    UseMutationOptions<LabelDTO, Error, CreateLabelInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLabelInput) => labelApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const labelMutations = {
  useCreate: useCreateLabel,
};

import type { CreateLabelInput, LabelDTO } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { labelApi } from "./label.api";
import { labelKeys } from "./label.keys";

export function useCreateLabel(
  options?: Omit<
    UseMutationOptions<LabelDTO, Error, CreateLabelInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreateLabelInput) => labelApi.create(input),
    ...options,
    meta: { invalidates: [labelKeys.all()] },
  });
}

export const labelMutations = {
  useCreate: useCreateLabel,
};

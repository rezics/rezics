import type {
  CreateUnitExternalLinkInput,
  UnitExternalLinkDTO,
  UpdateUnitExternalLinkInput,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { creditAttributionKeys } from "../credit-attribution/credit-attribution.keys";
import { unitExternalLinkApi } from "./unit-external-link.api";
import { unitExternalLinkKeys } from "./unit-external-link.keys";

// ponytail: root prefix; per-unit granularity if perf matters
// ponytail：根前缀；如需按 unit 精细化再拆
const invalidates = [unitExternalLinkKeys.all(), creditAttributionKeys.all()];

export function useCreateUnitExternalLink(
  options?: Omit<
    UseMutationOptions<UnitExternalLinkDTO, Error, CreateUnitExternalLinkInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreateUnitExternalLinkInput) =>
      unitExternalLinkApi.create(input),
    ...options,
    meta: { invalidates },
  });
}

export function useUpdateUnitExternalLink(
  options?: Omit<
    UseMutationOptions<
      UnitExternalLinkDTO,
      Error,
      { id: string; input: UpdateUnitExternalLinkInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ id, input }) => unitExternalLinkApi.update(id, input),
    ...options,
    meta: { invalidates },
  });
}

export function useDeleteUnitExternalLink(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { id: string; unitId?: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ id }) => unitExternalLinkApi.remove(id),
    ...options,
    meta: { invalidates },
  });
}

export const unitExternalLinkMutations = {
  useCreate: useCreateUnitExternalLink,
  useUpdate: useUpdateUnitExternalLink,
  useDelete: useDeleteUnitExternalLink,
};

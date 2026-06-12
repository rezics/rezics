import type {
  CreateUnitExternalLinkInput,
  UnitExternalLinkDTO,
  UpdateUnitExternalLinkInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { creditAttributionKeys } from "../credit-attribution/credit-attribution.keys";
import { unitExternalLinkApi } from "./unit-external-link.api";
import { unitExternalLinkKeys } from "./unit-external-link.keys";

export function invalidateUnitExternalLinkQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "invalidateQueries">,
  unitId?: string,
) {
  queryClient.invalidateQueries({ queryKey: unitExternalLinkKeys.lists() });
  if (unitId) {
    queryClient.invalidateQueries({
      queryKey: unitExternalLinkKeys.links(unitId),
    });
    queryClient.invalidateQueries({
      queryKey: creditAttributionKeys.byUnit(unitId),
    });
  }
}

export function useCreateUnitExternalLink(
  options?: Omit<
    UseMutationOptions<UnitExternalLinkDTO, Error, CreateUnitExternalLinkInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUnitExternalLinkInput) =>
      unitExternalLinkApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateUnitExternalLinkQueries(queryClient, data.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => unitExternalLinkApi.update(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateUnitExternalLinkQueries(queryClient, data.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => unitExternalLinkApi.remove(id),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateUnitExternalLinkQueries(queryClient, variables.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const unitExternalLinkMutations = {
  useCreate: useCreateUnitExternalLink,
  useUpdate: useUpdateUnitExternalLink,
  useDelete: useDeleteUnitExternalLink,
};

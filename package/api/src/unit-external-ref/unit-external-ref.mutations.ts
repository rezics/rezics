import type {
  CreateUnitExternalRefInput,
  UnitExternalRefDTO,
  UpdateUnitExternalRefInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { creditAttributionKeys } from "../credit-attribution/credit-attribution.keys";
import { unitExternalRefApi } from "./unit-external-ref.api";
import { unitExternalRefKeys } from "./unit-external-ref.keys";

export function invalidateUnitExternalRefQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "invalidateQueries">,
  unitId?: string,
) {
  queryClient.invalidateQueries({ queryKey: unitExternalRefKeys.lists() });
  if (unitId) {
    queryClient.invalidateQueries({
      queryKey: creditAttributionKeys.byUnit(unitId),
    });
  }
}

export function useCreateUnitExternalRef(
  options?: Omit<
    UseMutationOptions<UnitExternalRefDTO, Error, CreateUnitExternalRefInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUnitExternalRefInput) =>
      unitExternalRefApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateUnitExternalRefQueries(queryClient, data.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateUnitExternalRef(
  options?: Omit<
    UseMutationOptions<
      UnitExternalRefDTO,
      Error,
      { id: string; input: UpdateUnitExternalRefInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => unitExternalRefApi.update(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateUnitExternalRefQueries(queryClient, data.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteUnitExternalRef(
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
    mutationFn: ({ id }) => unitExternalRefApi.remove(id),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateUnitExternalRefQueries(queryClient, variables.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const unitExternalRefMutations = {
  useCreate: useCreateUnitExternalRef,
  useUpdate: useUpdateUnitExternalRef,
  useDelete: useDeleteUnitExternalRef,
};

import type {
  CastUnitAliasVoteInput,
  CreateUnitAliasInput,
  PatchUnitAliasPinInput,
  UnitAliasDTO,
  UpdateUnitAliasInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { unitAliasApi } from "./unit-alias.api";
import { unitAliasKeys } from "./unit-alias.keys";

function invalidateAliasLists(
  queryClient: ReturnType<typeof useQueryClient>,
  unitId?: string,
) {
  queryClient.invalidateQueries({ queryKey: unitAliasKeys.lists() });
  if (unitId) {
    queryClient.invalidateQueries({ queryKey: unitAliasKeys.forUnit(unitId) });
  }
}

export function useCreateUnitAliasMutation(
  options?: Omit<
    UseMutationOptions<UnitAliasDTO, Error, CreateUnitAliasInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUnitAliasInput) => unitAliasApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateAliasLists(queryClient, variables.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateUnitAliasMutation(
  options?: Omit<
    UseMutationOptions<
      UnitAliasDTO,
      Error,
      { aliasId: string; input: UpdateUnitAliasInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ aliasId, input }) => unitAliasApi.update(aliasId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(unitAliasKeys.detail(variables.aliasId), data);
      invalidateAliasLists(queryClient, data.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function usePatchUnitAliasPinMutation(
  options?: Omit<
    UseMutationOptions<
      UnitAliasDTO,
      Error,
      { aliasId: string; input: PatchUnitAliasPinInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ aliasId, input }) => unitAliasApi.patchPin(aliasId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(unitAliasKeys.detail(variables.aliasId), data);
      invalidateAliasLists(queryClient, data.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useHideUnitAliasMutation(
  options?: Omit<UseMutationOptions<UnitAliasDTO, Error, string>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (aliasId: string) => unitAliasApi.hide(aliasId),
    ...options,
    onSuccess: (data, aliasId, onMutateResult, context) => {
      queryClient.setQueryData(unitAliasKeys.detail(aliasId), data);
      invalidateAliasLists(queryClient, data.unitId);
      options?.onSuccess?.(data, aliasId, onMutateResult, context);
    },
  });
}

export function useDeleteUnitAliasMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { aliasId: string; unitId?: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ aliasId }) => unitAliasApi.remove(aliasId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.removeQueries({
        queryKey: unitAliasKeys.detail(variables.aliasId),
      });
      invalidateAliasLists(queryClient, variables.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCastUnitAliasVoteMutation(
  options?: Omit<
    UseMutationOptions<UnitAliasDTO, Error, CastUnitAliasVoteInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CastUnitAliasVoteInput) => unitAliasApi.vote(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(unitAliasKeys.detail(variables.aliasId), data);
      invalidateAliasLists(queryClient, data.unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const unitAliasMutations = {
  useCreate: useCreateUnitAliasMutation,
  useUpdate: useUpdateUnitAliasMutation,
  usePatchPin: usePatchUnitAliasPinMutation,
  useHide: useHideUnitAliasMutation,
  useDelete: useDeleteUnitAliasMutation,
  useVote: useCastUnitAliasVoteMutation,
};

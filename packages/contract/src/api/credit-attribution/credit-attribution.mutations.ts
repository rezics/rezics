import type {
  CreateCreditAttributionEvidenceInput,
  CreditAttributionDTO,
  CreditAttributionRole,
  LinkCreditAttributionInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { bookKeys } from "../book/book.keys";
import { entityKeys } from "../entity/entity.keys";
import { creditAttributionApi } from "./credit-attribution.api";
import { creditAttributionKeys } from "./credit-attribution.keys";

export function useLinkCreditAttributionMutation(
  options?: Omit<
    UseMutationOptions<CreditAttributionDTO, Error, LinkCreditAttributionInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkCreditAttributionInput) =>
      creditAttributionApi.link(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: creditAttributionKeys.byUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: bookKeys.detail(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: entityKeys.searches() });
      queryClient.invalidateQueries({
        queryKey: entityKeys.detail(variables.entityId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnlinkCreditAttributionMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; entityId: string; role: CreditAttributionRole }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, entityId, role }) =>
      creditAttributionApi.unlink(unitId, entityId, role),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: creditAttributionKeys.byUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: bookKeys.detail(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: entityKeys.searches() });
      queryClient.invalidateQueries({
        queryKey: entityKeys.detail(variables.entityId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateCreditAttributionEvidenceMutation(
  options?: Omit<
    UseMutationOptions<
      CreditAttributionDTO,
      Error,
      CreateCreditAttributionEvidenceInput
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCreditAttributionEvidenceInput) =>
      creditAttributionApi.createEvidence(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: creditAttributionKeys.byUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: bookKeys.detail(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const creditAttributionMutations = {
  useLink: useLinkCreditAttributionMutation,
  useUnlink: useUnlinkCreditAttributionMutation,
  useCreateEvidence: useCreateCreditAttributionEvidenceMutation,
};

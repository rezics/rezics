import type {
  UnitWorkMembershipBody,
  WorkMembershipClaimDTO,
  WorkMembershipClaimRejectBody,
  UnitWorkMembershipResponse,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { unitKeys } from "./unit.keys";
import { unitWorkMembershipApi } from "./unit-work-membership.api";
import { unitWorkMembershipKeys } from "./unit-work-membership.keys";

export function usePatchUnitWorkMembershipMutation(
  options?: Omit<
    UseMutationOptions<
      UnitWorkMembershipResponse,
      Error,
      { releaseId: string; body: UnitWorkMembershipBody }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, body }) =>
      unitWorkMembershipApi.patchMembership(releaseId, body),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(variables.releaseId),
      });
      queryClient.invalidateQueries({
        queryKey: unitWorkMembershipKeys.claims(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useApproveWorkMembershipClaimMutation(
  options?: Omit<
    UseMutationOptions<WorkMembershipClaimDTO, Error, { claimId: string }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId }) => unitWorkMembershipApi.approveClaim(claimId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitWorkMembershipKeys.claims(),
      });
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(data.releaseUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRejectWorkMembershipClaimMutation(
  options?: Omit<
    UseMutationOptions<
      WorkMembershipClaimDTO,
      Error,
      { claimId: string; body: WorkMembershipClaimRejectBody }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, body }) =>
      unitWorkMembershipApi.rejectClaim(claimId, body),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitWorkMembershipKeys.claims(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useWithdrawWorkMembershipClaimMutation(
  options?: Omit<
    UseMutationOptions<WorkMembershipClaimDTO, Error, { claimId: string }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId }) => unitWorkMembershipApi.withdrawClaim(claimId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitWorkMembershipKeys.claims(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const unitWorkMembershipMutations = {
  usePatch: usePatchUnitWorkMembershipMutation,
  useApprove: useApproveWorkMembershipClaimMutation,
  useReject: useRejectWorkMembershipClaimMutation,
  useWithdraw: useWithdrawWorkMembershipClaimMutation,
};

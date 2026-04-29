import type {
  WorkLinkBody,
  WorkLinkClaimDTO,
  WorkLinkClaimRejectBody,
  WorkLinkResponse,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { unitKeys } from "./unit.keys";
import { workLinkApi } from "./work-link.api";
import { workLinkKeys } from "./work-link.keys";

export function usePatchWorkLinkMutation(
  options?: Omit<
    UseMutationOptions<
      WorkLinkResponse,
      Error,
      { releaseId: string; body: WorkLinkBody }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, body }) =>
      workLinkApi.patchWorkLink(releaseId, body),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(variables.releaseId),
      });
      queryClient.invalidateQueries({ queryKey: workLinkKeys.claims() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useApproveWorkLinkClaimMutation(
  options?: Omit<
    UseMutationOptions<WorkLinkClaimDTO, Error, { claimId: string }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId }) => workLinkApi.approveClaim(claimId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: workLinkKeys.claims() });
      queryClient.invalidateQueries({
        queryKey: unitKeys.detail(data.releaseUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRejectWorkLinkClaimMutation(
  options?: Omit<
    UseMutationOptions<
      WorkLinkClaimDTO,
      Error,
      { claimId: string; body: WorkLinkClaimRejectBody }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, body }) =>
      workLinkApi.rejectClaim(claimId, body),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: workLinkKeys.claims() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useWithdrawWorkLinkClaimMutation(
  options?: Omit<
    UseMutationOptions<WorkLinkClaimDTO, Error, { claimId: string }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId }) => workLinkApi.withdrawClaim(claimId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: workLinkKeys.claims() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const workLinkMutations = {
  usePatch: usePatchWorkLinkMutation,
  useApprove: useApproveWorkLinkClaimMutation,
  useReject: useRejectWorkLinkClaimMutation,
  useWithdraw: useWithdrawWorkLinkClaimMutation,
};

import type {
  AdminWorkMergeOperation,
  AdminWorkMergePreview,
  AdminWorkMergeRequest,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { adminWorkMergeApi } from "./admin-work-merge.api";
import { adminWorkMergeKeys } from "./admin-work-merge.keys";

export function usePreviewAdminWorkMergeMutation(
  options?: Omit<
    UseMutationOptions<AdminWorkMergePreview, Error, AdminWorkMergeRequest>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: adminWorkMergeApi.preview,
    ...options,
  });
}

export function useStartAdminWorkMergeMutation(
  options?: Omit<
    UseMutationOptions<AdminWorkMergeOperation, Error, AdminWorkMergeRequest>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminWorkMergeApi.start,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(adminWorkMergeKeys.detail(data.id), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRevertAdminWorkMergeMutation(
  options?: Omit<
    UseMutationOptions<AdminWorkMergeOperation, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminWorkMergeApi.revert,
    ...options,
    onSuccess: (data, operationId, onMutateResult, context) => {
      queryClient.setQueryData(adminWorkMergeKeys.detail(operationId), data);
      options?.onSuccess?.(data, operationId, onMutateResult, context);
    },
  });
}

export const adminWorkMergeMutations = {
  usePreview: usePreviewAdminWorkMergeMutation,
  useStart: useStartAdminWorkMergeMutation,
  useRevert: useRevertAdminWorkMergeMutation,
};

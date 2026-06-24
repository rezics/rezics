import type {
  AdminRepairJob,
  AdminRepairJobDryRun,
  AdminRepairJobDryRunRequest,
  AdminRepairJobOperationRequest,
  AdminRepairJobOperationResponse,
  AdminRepairJobStartRequest,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { adminRepairJobApi } from "./admin-repair-job.api";

export function useAdminRepairJobDryRunMutation(
  options?: Omit<
    UseMutationOptions<
      AdminRepairJobDryRun,
      Error,
      AdminRepairJobDryRunRequest
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input) => adminRepairJobApi.dryRun(input),
    ...options,
  });
}

export function useAdminRepairJobStartMutation(
  options?: Omit<
    UseMutationOptions<AdminRepairJob, Error, AdminRepairJobStartRequest>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input) => adminRepairJobApi.start(input),
    ...options,
  });
}

export function useAdminRepairJobRetryOperationMutation(
  options?: Omit<
    UseMutationOptions<
      AdminRepairJobOperationResponse,
      Error,
      AdminRepairJobOperationRequest
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input) => adminRepairJobApi.retryOperation(input),
    ...options,
  });
}

export function useAdminRepairJobCancelOperationMutation(
  options?: Omit<
    UseMutationOptions<
      AdminRepairJobOperationResponse,
      Error,
      AdminRepairJobOperationRequest
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input) => adminRepairJobApi.cancelOperation(input),
    ...options,
  });
}

export const adminRepairJobMutations = {
  dryRun: useAdminRepairJobDryRunMutation,
  start: useAdminRepairJobStartMutation,
  retryOperation: useAdminRepairJobRetryOperationMutation,
  cancelOperation: useAdminRepairJobCancelOperationMutation,
};

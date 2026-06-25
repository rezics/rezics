import type {
  AdminRepairJob,
  AdminRepairJobDryRun,
  AdminRepairJobDryRunRequest,
  AdminRepairJobStartRequest,
} from "@rezics/contract";
import useSWRMutation from "swr/mutation";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type RepairJobDryRunKey = readonly ["eden", "admin", "repair-job", "dry-run"];
type RepairJobStartKey = readonly ["eden", "admin", "repair-job", "start"];

type MutationCallbacks<Data> = {
  onError?: (error: Error) => void;
  onSuccess?: (data: Data) => void;
};

const REPAIR_JOB_DRY_RUN_KEY = [
  "eden",
  "admin",
  "repair-job",
  "dry-run",
] as const satisfies RepairJobDryRunKey;

const REPAIR_JOB_START_KEY = [
  "eden",
  "admin",
  "repair-job",
  "start",
] as const satisfies RepairJobStartKey;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function dryRunRepairJob(
  _key: RepairJobDryRunKey,
  { arg }: { arg: AdminRepairJobDryRunRequest },
): Promise<AdminRepairJobDryRun> {
  const response = await apiClient.admin["repair-job"]["dry-run"].post(arg);
  return unwrapEdenResponse(response);
}

async function startRepairJob(
  _key: RepairJobStartKey,
  { arg }: { arg: AdminRepairJobStartRequest },
): Promise<AdminRepairJob> {
  const response = await apiClient.admin["repair-job"].post(arg);
  return unwrapEdenResponse(response);
}

export function useAdminRepairJobDryRunMutation(
  options?: MutationCallbacks<AdminRepairJobDryRun>,
) {
  const mutation = useSWRMutation<
    AdminRepairJobDryRun,
    Error,
    RepairJobDryRunKey,
    AdminRepairJobDryRunRequest
  >(REPAIR_JOB_DRY_RUN_KEY, dryRunRepairJob);

  const mutateAsync = async (input: AdminRepairJobDryRunRequest) => {
    try {
      const dryRun = await mutation.trigger(input);
      options?.onSuccess?.(dryRun);
      return dryRun;
    } catch (error) {
      const normalized = toError(error);
      options?.onError?.(normalized);
      throw normalized;
    }
  };

  return {
    error: mutation.error,
    isError: Boolean(mutation.error),
    isPending: mutation.isMutating,
    mutate: (input: AdminRepairJobDryRunRequest) => {
      void mutateAsync(input).catch(() => undefined);
    },
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useAdminRepairJobStartMutation(
  options?: MutationCallbacks<AdminRepairJob>,
) {
  const mutation = useSWRMutation<
    AdminRepairJob,
    Error,
    RepairJobStartKey,
    AdminRepairJobStartRequest
  >(REPAIR_JOB_START_KEY, startRepairJob);

  const mutateAsync = async (input: AdminRepairJobStartRequest) => {
    try {
      const job = await mutation.trigger(input);
      options?.onSuccess?.(job);
      return job;
    } catch (error) {
      const normalized = toError(error);
      options?.onError?.(normalized);
      throw normalized;
    }
  };

  return {
    error: mutation.error,
    isError: Boolean(mutation.error),
    isPending: mutation.isMutating,
    mutate: (input: AdminRepairJobStartRequest) => {
      void mutateAsync(input).catch(() => undefined);
    },
    mutateAsync,
    reset: mutation.reset,
  };
}

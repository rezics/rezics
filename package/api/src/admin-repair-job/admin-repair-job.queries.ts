import type { AdminRepairJobDryRunRequest } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { adminRepairJobApi } from "./admin-repair-job.api";
import { adminRepairJobKeys } from "./admin-repair-job.keys";

export const adminRepairJobDryRunQuery = (input: AdminRepairJobDryRunRequest) =>
  queryOptions({
    queryKey: adminRepairJobKeys.dryRun(input),
    queryFn: () => adminRepairJobApi.dryRun(input),
    enabled: Boolean(input.scope),
    staleTime: 1000 * 30,
  });

export const adminRepairJobQueries = {
  dryRun: adminRepairJobDryRunQuery,
};

import type { AdminRepairJobDryRunRequest } from "@rezics/contract";

export const adminRepairJobKeys = {
  all: ["admin-repair-jobs"] as const,
  dryRun: (input: AdminRepairJobDryRunRequest) =>
    [...adminRepairJobKeys.all, "dry-run", input] as const,
};

import type {
  AdminRepairJob,
  AdminRepairJobDryRun,
  AdminRepairJobDryRunRequest,
  AdminRepairJobOperationRequest,
  AdminRepairJobOperationResponse,
  AdminRepairJobStartRequest,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const adminRepairJobApi = {
  dryRun(input: AdminRepairJobDryRunRequest) {
    return apiFetch<AdminRepairJobDryRun>("/admin/repair-job/dry-run", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  start(input: AdminRepairJobStartRequest) {
    return apiFetch<AdminRepairJob>("/admin/repair-job", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  retryOperation(input: AdminRepairJobOperationRequest) {
    return apiFetch<AdminRepairJobOperationResponse>(
      "/admin/repair-job/operation/retry",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  cancelOperation(input: AdminRepairJobOperationRequest) {
    return apiFetch<AdminRepairJobOperationResponse>(
      "/admin/repair-job/operation/cancel",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};

import type {
  AdminWorkMergeOperation,
  AdminWorkMergePreview,
  AdminWorkMergeRequest,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const adminWorkMergeApi = {
  preview: async (
    input: AdminWorkMergeRequest,
  ): Promise<AdminWorkMergePreview> => {
    return apiFetch<AdminWorkMergePreview>("/admin/work-merge/preview", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  start: async (
    input: AdminWorkMergeRequest,
  ): Promise<AdminWorkMergeOperation> => {
    return apiFetch<AdminWorkMergeOperation>("/admin/work-merge", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  get: async (operationId: string): Promise<AdminWorkMergeOperation> => {
    return apiFetch<AdminWorkMergeOperation>(
      `/admin/work-merge/${operationId}`,
    );
  },

  revert: async (operationId: string): Promise<AdminWorkMergeOperation> => {
    return apiFetch<AdminWorkMergeOperation>(
      `/admin/work-merge/${operationId}/revert`,
      { method: "POST" },
    );
  },
};

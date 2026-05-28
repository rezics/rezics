import type {
  CreateWorkRealmContextInput,
  ListWorkRealmContextQuery,
  ResolvedWorkRealmContext,
  ResolveWorkRealmContextQuery,
  UpdateWorkRealmContextInput,
  WorkRealmContextDTO,
  WorkRealmContextListResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const workRealmContextApi = {
  list: async (
    query?: ListWorkRealmContextQuery,
  ): Promise<WorkRealmContextListResponse> => {
    return apiFetch<WorkRealmContextListResponse>(
      `/work-realm-context/list${buildQueryString(query)}`,
    );
  },

  get: async (contextId: string): Promise<WorkRealmContextDTO> => {
    return apiFetch<WorkRealmContextDTO>(
      `/work-realm-context/${encodeURIComponent(contextId)}`,
    );
  },

  resolve: async (
    query: ResolveWorkRealmContextQuery,
  ): Promise<ResolvedWorkRealmContext> => {
    return apiFetch<ResolvedWorkRealmContext>(
      `/work-realm-context/resolve${buildQueryString(query)}`,
    );
  },

  create: async (
    input: CreateWorkRealmContextInput,
  ): Promise<WorkRealmContextDTO> => {
    return apiFetch<WorkRealmContextDTO>("/work-realm-context", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    contextId: string,
    input: UpdateWorkRealmContextInput,
  ): Promise<WorkRealmContextDTO> => {
    return apiFetch<WorkRealmContextDTO>(
      `/work-realm-context/${encodeURIComponent(contextId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  remove: async (contextId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/work-realm-context/${encodeURIComponent(contextId)}`,
      {
        method: "DELETE",
      },
    );
  },
};

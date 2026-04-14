/**
 * Meilisearch admin API wrapper and React Query hooks.
 *
 * Backend routes:
 * - /meili/health
 * - /meili/content|feedbacks|users/(init|sync)
 * - /meili/content/deleteAll
 * - /meili/keys/admin|(list|delete)
 */

import {
  queryOptions,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";

export type MeiliHealthResponse = {
  status: string;
};

export type MeiliApiMessageResponse = {
  message: string;
};

export type MeiliTaskResponse = {
  task: unknown;
};

export type MeiliKey = {
  uid: string;
  name?: string | null;
  description?: string | null;
  actions?: string[];
  indexes?: string[];
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type MeiliKeyListResponse = {
  results: MeiliKey[];
  limit: number;
  offset: number;
  total: number;
};

/**
 * Pure HTTP wrappers (no React Query dependency).
 */
export const meiliAdminApi = {
  health: async (): Promise<MeiliHealthResponse> => {
    return apiFetch<MeiliHealthResponse>("/meili/health");
  },

  // Index initialization
  initContentIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/content/init", {
      method: "POST",
    });
  },
  initFeedbacksIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/feedbacks/init", {
      method: "POST",
    });
  },
  initUsersIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/users/init", {
      method: "POST",
    });
  },

  // Full sync
  syncAllContent: async (): Promise<MeiliTaskResponse> => {
    return apiFetch<MeiliTaskResponse>("/meili/content/sync", {
      method: "POST",
    });
  },
  syncAllFeedbacks: async (): Promise<MeiliTaskResponse> => {
    return apiFetch<MeiliTaskResponse>("/meili/feedbacks/sync", {
      method: "POST",
    });
  },
  syncAllUsers: async (): Promise<MeiliTaskResponse> => {
    return apiFetch<MeiliTaskResponse>("/meili/users/sync", {
      method: "POST",
    });
  },

  // Dangerous operations
  deleteAllContent: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/content/deleteAll");
  },
  deleteAllFeedbacks: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/feedbacks/deleteAll", {
      method: "DELETE",
    });
  },
  deleteAllUsers: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/users/deleteAll", {
      method: "DELETE",
    });
  },
  resetAllIndexes: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/indexes/resetAll", {
      method: "DELETE",
    });
  },

  // Key management
  createAdminKey: async (): Promise<MeiliKey> => {
    return apiFetch<MeiliKey>("/meili/keys/admin", {
      method: "POST",
    });
  },
  listKeys: async (): Promise<MeiliKeyListResponse> => {
    return apiFetch<MeiliKeyListResponse>("/meili/keys");
  },
  deleteKey: async (uid: string): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>(`/meili/keys/${uid}`, {
      method: "DELETE",
    });
  },
};

/**
 * React Query options.
 */
export const meiliAdminQueries = {
  health: () =>
    queryOptions({
      queryKey: ["meili", "admin", "health"],
      queryFn: () => meiliAdminApi.health(),
      staleTime: 1000 * 5,
    }),
  keys: () =>
    queryOptions({
      queryKey: ["meili", "admin", "keys"],
      queryFn: () => meiliAdminApi.listKeys(),
      staleTime: 1000 * 30,
    }),
};

/**
 * Mutation hooks for admin operations.
 */

export function useMeiliInitContentIndexMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.initContentIndex(),
    ...options,
  });
}

export function useMeiliInitFeedbacksIndexMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.initFeedbacksIndex(),
    ...options,
  });
}

export function useMeiliInitUsersIndexMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.initUsersIndex(),
    ...options,
  });
}

export function useMeiliSyncContentMutation(
  options?: Omit<
    UseMutationOptions<MeiliTaskResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.syncAllContent(),
    ...options,
  });
}

export function useMeiliSyncFeedbacksMutation(
  options?: Omit<
    UseMutationOptions<MeiliTaskResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.syncAllFeedbacks(),
    ...options,
  });
}

export function useMeiliSyncUsersMutation(
  options?: Omit<
    UseMutationOptions<MeiliTaskResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.syncAllUsers(),
    ...options,
  });
}

export function useMeiliDeleteAllContentMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.deleteAllContent(),
    ...options,
  });
}

export function useMeiliDeleteAllFeedbacksMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.deleteAllFeedbacks(),
    ...options,
  });
}

export function useMeiliDeleteAllUsersMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.deleteAllUsers(),
    ...options,
  });
}

export function useMeiliResetAllIndexesMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.resetAllIndexes(),
    ...options,
  });
}

export function useMeiliCreateAdminKeyMutation(
  options?: Omit<UseMutationOptions<MeiliKey, Error, void>, "mutationFn">,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.createAdminKey(),
    ...options,
  });
}

export function useMeiliDeleteKeyMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uid: string) => meiliAdminApi.deleteKey(uid),
    ...options,
    onSuccess: (data, uid, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: ["meili", "admin", "keys"] });
      options?.onSuccess?.(data, uid, onMutateResult, context);
    },
  });
}

export const meiliAdminMutations = {
  useInitContentIndex: useMeiliInitContentIndexMutation,
  useInitFeedbacksIndex: useMeiliInitFeedbacksIndexMutation,
  useInitUsersIndex: useMeiliInitUsersIndexMutation,
  useSyncContent: useMeiliSyncContentMutation,
  useSyncFeedbacks: useMeiliSyncFeedbacksMutation,
  useSyncUsers: useMeiliSyncUsersMutation,
  useDeleteAllContent: useMeiliDeleteAllContentMutation,
  useDeleteAllFeedbacks: useMeiliDeleteAllFeedbacksMutation,
  useDeleteAllUsers: useMeiliDeleteAllUsersMutation,
  useResetAllIndexes: useMeiliResetAllIndexesMutation,
  useCreateAdminKey: useMeiliCreateAdminKeyMutation,
  useDeleteKey: useMeiliDeleteKeyMutation,
};

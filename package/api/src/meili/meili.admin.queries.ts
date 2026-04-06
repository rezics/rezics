/**
 * Meilisearch 管理端 API 封装 & React Query 配置
 *
 * 对应后端 `package/server/src/meili/meili.api.ts` 中的管理路由：
 * - /meili/health
 * - /meili/books|readlists|units/(init|sync)
 * - /meili/units/deleteAllUnits
 * - /meili/keys/search|admin|(list|delete)
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

// 参照 Meilisearch 官方 Key 结构，做一个前端用的轻量类型
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

export type MeiliSearchKeyResponse = {
  key: string;
};

/**
 * 纯 HTTP 封装，不依赖 React Query，方便在任意地方直接调用。
 */
export const meiliAdminApi = {
  // 健康检查（不需要权限）
  health: async (): Promise<MeiliHealthResponse> => {
    return apiFetch<MeiliHealthResponse>("/meili/health");
  },

  // 索引初始化
  initUsersIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/users/init", {
      method: "POST",
    });
  },
  initBooksIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/books/init", {
      method: "POST",
    });
  },
  initReadlistsIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/readlists/init", {
      method: "POST",
    });
  },
  initUnitsIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/units/init", {
      method: "POST",
    });
  },
  initFeedbacksIndex: async (): Promise<MeiliApiMessageResponse> => {
    return apiFetch<MeiliApiMessageResponse>("/meili/feedbacks/init", {
      method: "POST",
    });
  },

  // 全量同步
  syncAllBooks: async (): Promise<MeiliTaskResponse> => {
    return apiFetch<MeiliTaskResponse>("/meili/books/sync", {
      method: "POST",
    });
  },
  syncAllReadlists: async (): Promise<MeiliTaskResponse> => {
    return apiFetch<MeiliTaskResponse>("/meili/readlists/sync", {
      method: "POST",
    });
  },
  syncAllUnits: async (): Promise<MeiliTaskResponse> => {
    return apiFetch<MeiliTaskResponse>("/meili/units/sync", {
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

  // 危险操作：删除全部 units
  deleteAllUnits: async (): Promise<MeiliApiMessageResponse> => {
    // 后端是 GET /meili/units/deleteAllUnits
    return apiFetch<MeiliApiMessageResponse>("/meili/units/deleteAllUnits");
  },

  // Key 管理
  createSearchKey: async (): Promise<MeiliSearchKeyResponse> => {
    return apiFetch<MeiliSearchKeyResponse>("/meili/keys/search", {
      method: "POST",
    });
  },
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
 * React Query QueryOptions - 方便在页面里直接 useQuery 使用。
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
 * 一些常用的 Mutation Hook，供管理页面直接使用。
 */

export function useMeiliInitBooksIndexMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.initBooksIndex(),
    ...options,
  });
}

export function useMeiliInitReadlistsIndexMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.initReadlistsIndex(),
    ...options,
  });
}

export function useMeiliInitUnitsIndexMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.initUnitsIndex(),
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

export function useMeiliSyncBooksMutation(
  options?: Omit<
    UseMutationOptions<MeiliTaskResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.syncAllBooks(),
    ...options,
  });
}

export function useMeiliSyncReadlistsMutation(
  options?: Omit<
    UseMutationOptions<MeiliTaskResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.syncAllReadlists(),
    ...options,
  });
}

export function useMeiliSyncUnitsMutation(
  options?: Omit<
    UseMutationOptions<MeiliTaskResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.syncAllUnits(),
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
export function useMeiliDeleteAllUnitsMutation(
  options?: Omit<
    UseMutationOptions<MeiliApiMessageResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.deleteAllUnits(),
    ...options,
  });
}

export function useMeiliCreateSearchKeyMutation(
  options?: Omit<
    UseMutationOptions<MeiliSearchKeyResponse, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: () => meiliAdminApi.createSearchKey(),
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
      // 删除成功后刷新 key 列表
      queryClient.invalidateQueries({ queryKey: ["meili", "admin", "keys"] });
      options?.onSuccess?.(data, uid, onMutateResult, context);
    },
  });
}

export const meiliAdminMutations = {
  useInitBooksIndex: useMeiliInitBooksIndexMutation,
  useInitReadlistsIndex: useMeiliInitReadlistsIndexMutation,
  useInitUnitsIndex: useMeiliInitUnitsIndexMutation,
  useInitFeedbacksIndex: useMeiliInitFeedbacksIndexMutation,
  useInitUsersIndex: useMeiliInitUsersIndexMutation,
  useSyncBooks: useMeiliSyncBooksMutation,
  useSyncReadlists: useMeiliSyncReadlistsMutation,
  useSyncUnits: useMeiliSyncUnitsMutation,
  useSyncFeedbacks: useMeiliSyncFeedbacksMutation,
  useSyncUsers: useMeiliSyncUsersMutation,
  useDeleteAllUnits: useMeiliDeleteAllUnitsMutation,
  useCreateSearchKey: useMeiliCreateSearchKeyMutation,
  useCreateAdminKey: useMeiliCreateAdminKeyMutation,
  useDeleteKey: useMeiliDeleteKeyMutation,
};

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { getApiConfig } from "../config";

/**
 * Persist react-query to localStorage.
 * 将 react-query 持久化到 localStorage。
 * @param queryClient
 * @param param1
 */
export function attachPersistence(
  queryClient: QueryClient,
  {
    key = "rq-cache",
    maxAge = 24 * 60 * 60 * 1000, // 24h — 24 小时
    buster = getApiConfig().appVersion ?? "v1",
  } = {},
) {
  const persister = createSyncStoragePersister({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    throttleTime: 1000, // Reduce write frequency — 降低写入频率
    key,
    serialize: (client) => JSON.stringify(client),
    deserialize: (cached) => JSON.parse(cached),
  });

  persistQueryClient({
    queryClient,
    persister,
    // Only persist successful queries; carry a buster so the whole cache can be
    // invalidated during staged rollout or rollback.
    // 仅持久化成功的查询；并带上 buster，以便灰度/回滚时整体失效。
    dehydrateOptions: {
      shouldDehydrateQuery: (q) => q.state.status === "success",
    },
    maxAge,
    buster,
  });
}

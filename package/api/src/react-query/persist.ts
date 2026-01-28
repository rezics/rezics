import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

/**
 * localStorage 持久化 react-query
 * @param queryClient
 * @param param1
 */
export function attachPersistence(
  queryClient: QueryClient,
  {
    key = "rq-cache",
    maxAge = 24 * 60 * 60 * 1000, // 24h
    buster = import.meta.env.VITE_APP_VERSION ?? "v1",
  } = {},
) {
  const persister = createSyncStoragePersister({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    throttleTime: 1000, // 降低写入频率
    key,
    serialize: (client) => JSON.stringify(client),
    deserialize: (cached) => JSON.parse(cached),
  });

  persistQueryClient({
    queryClient,
    persister,
    // 仅持久化成功的查询；并且带上 buster 以便灰度/回滚时整体失效
    dehydrateOptions: {
      shouldDehydrateQuery: (q) => q.state.status === "success",
    },
    maxAge,
    buster,
  });
}

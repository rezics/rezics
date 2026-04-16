import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errors";

// === 基础 QueryClient（必选） ===
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 统一“不过度打扰”的策略：你可以按接口 TTL 全局设 30s~5min
        staleTime: 60_000, // 1min：新鲜期内不触发后台重取（文档推荐通过 staleTime 控制）
        gcTime: 10 * 60_000, // 10min：非活跃查询的保留时长（v5 用 gcTime）
        refetchOnWindowFocus: false, // 常见业务不希望聚焦就跳 UI
        refetchOnReconnect: true,
        refetchOnMount: false, // 避免重复装载时无谓重取（配合 staleTime 使用）
        // 对 4xx（除 408）不重试，其他最多 2 次，指数退避上限 30s
        retry(failureCount, error) {
          if (error instanceof ApiError) {
            const { status } = error;
            if (status >= 400 && status < 500 && status !== 408) return false;
          }
          return failureCount < 2;
        },
        retryDelay(attempt) {
          return Math.min(1000 * 2 ** attempt, 30_000);
        },
        // 常规 Web：保持默认 networkMode:'online'；离线优先见下
        // networkMode: "offlineFirst",
        // throwOnError 可与 ErrorBoundary 配合
        // throwOnError: (e, query) => false,
      },
      mutations: {
        retry: 0, // 变更默认不重试，失败由 UI/重试按钮驱动
      },
    },
  });
}

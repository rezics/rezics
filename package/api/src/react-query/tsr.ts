import {
  MutationCache,
  QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { ApiError } from "./errors";

// Declarative cache invalidation. A mutation lists the query-key prefixes it
// must invalidate via `meta.invalidates`; one global handler runs them all on
// success. This replaces per-mutation `useQueryClient()` + hand-wired
// `onSuccess` invalidation (and the easy-to-forget manual re-chaining of the
// caller's `onSuccess`), so a write that forgets to refresh stale UI becomes
// impossible by construction. This is the TanStack Query `MutationCache.meta`
// pattern — the single, canonical place mutations declare what they touch.
// 声明式缓存失效。mutation 通过 `meta.invalidates` 列出它必须失效的 query-key
// 前缀，一个全局 handler 在成功时统一执行。它取代了每个 mutation 各自的
// `useQueryClient()` + 手写 `onSuccess` 失效（以及极易遗忘的、对调用方
// `onSuccess` 的手动重链），使「写入后忘记刷新陈旧 UI」在结构上不可能发生。
// 这是 TanStack Query 的 `MutationCache.meta` 正典模式——mutation 声明它触及
// 哪些缓存的唯一、规范的落点。
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Query-key prefixes to invalidate after this mutation succeeds.
       * Invalidation is by prefix (the default `invalidateQueries` behavior),
       * so listing a root key refreshes every query nested under it.
       * 此 mutation 成功后要失效的 query-key 前缀。按前缀失效（`invalidateQueries`
       * 的默认行为），因此列出一个根键即可刷新其下嵌套的所有查询。
       */
      invalidates?: readonly QueryKey[];
    };
  }
}

export interface CreateQueryClientOptions {
  onMutationError?: (error: Error) => void;
}

// === 基础 QueryClient（必选） ===
export function createQueryClient(options?: CreateQueryClientOptions) {
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess(_data, _variables, _onMutateResult, mutation) {
        // Run the mutation's declared invalidations. Mutations that need
        // optimistic patches or `removeQueries` still do that in their own
        // `onSuccess`; this only owns the declarative invalidate step.
        // 执行 mutation 声明的失效。需要乐观更新或 `removeQueries` 的
        // mutation 仍在自身 `onSuccess` 里处理；这里只负责声明式失效这一步。
        const invalidates = mutation.meta?.invalidates;
        if (!invalidates) return;
        for (const queryKey of invalidates) {
          void queryClient.invalidateQueries({ queryKey });
        }
      },
      onError(error, _variables, _context, mutation) {
        // Skip if the callsite already handles errors via its own onError
        // 如果调用点已通过自身 onError 处理错误，则跳过
        if (mutation.options.onError) return;
        options?.onMutationError?.(error);
      },
    }),
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
  return queryClient;
}

import type { DashboardSectionResult } from "@rezics/contract";

/**
 * Wrap a fan-out section so one source failing never fails the response.
 * 包装一个扇出区块，使单个数据源失败时绝不会让整个响应失败。
 */
export async function section<T>(
  load: () => Promise<T>,
  code = "SECTION_FAILED",
): Promise<DashboardSectionResult<T>> {
  try {
    return { ok: await load() };
  } catch {
    return { error: { code, retryable: true } };
  }
}

/**
 * Sections the server does not aggregate yet (they live in the notify
 * service or have no unified server source). The client fetches these
 * through their dedicated `@rezics/api` hooks; the dashboard reports a
 * non-retryable "not aggregated here" marker so the UI can decide to fetch
 * directly rather than show a transient error.
 * 服务端尚未聚合的区块（它们位于 notify 服务中，或没有统一的服务端数据源）。
 * 客户端通过其专用的 `@rezics/api` hooks 获取这些数据；dashboard 报告一个不可
 * 重试的 "not aggregated here" 标记，以便 UI 决定直接获取，而不是显示瞬时错误。
 */
export function notAggregated(): {
  error: { code: string; retryable: boolean };
} {
  return { error: { code: "NOT_AGGREGATED", retryable: false } };
}

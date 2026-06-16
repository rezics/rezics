import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { notificationKeys } from "./notification.keys";
import { getNotifyStreamUrl } from "./notify-fetch";

/**
 * Subscribes to notify's SSE `/stream` endpoint and refreshes notification
 * caches on each incoming event. Authenticates via the `rezics-session-token`
 * cookie sent automatically when `withCredentials: true` is set (under the
 * `subdomain-trust-boundary` cookie scope).
 *
 * Mount this once per authenticated app shell (typically in `MainNavigation`).
 * Auto-reconnect is handled by the browser; on each reconnect or new event
 * we invalidate the list + unread-count queries so they re-fetch.
 *
 * Pass `enabled: false` (or omit when not authenticated) to skip the stream.
 *
 * 订阅 notify 的 SSE `/stream` 端点，并在每个到来的事件上刷新通知缓存。
 * 通过在设置 `withCredentials: true` 时自动发送的 `rezics-session-token`
 * cookie 进行鉴权（处于 `subdomain-trust-boundary` cookie 作用域下）。
 *
 * 每个已鉴权的应用外壳挂载一次（通常在 `MainNavigation` 中）。
 * 自动重连由浏览器处理；在每次重连或新事件上，我们失效列表 + 未读计数
 * 查询，使其重新拉取。
 *
 * 传入 `enabled: false`（或在未鉴权时省略）以跳过该流。
 */
export function useNotificationStream(input?: { enabled?: boolean }): void {
  const enabled = input?.enabled ?? true;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const url = getNotifyStreamUrl();
    if (!url) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(url, { withCredentials: true });
    } catch {
      return;
    }

    const handleMessage = () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    };

    const handleError = () => {
      // EventSource auto-reconnects on transient failure. On the next open,
      // invalidating queries will backfill any events missed during the gap.
      // EventSource 在瞬时失败时自动重连。在下一次打开时，失效查询会回填
      // 间隙期间错过的任何事件。
    };

    es.addEventListener("message", handleMessage);
    es.addEventListener("error", handleError);

    return () => {
      es?.removeEventListener("message", handleMessage);
      es?.removeEventListener("error", handleError);
      es?.close();
    };
  }, [enabled, queryClient]);
}

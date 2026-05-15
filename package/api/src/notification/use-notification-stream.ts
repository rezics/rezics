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

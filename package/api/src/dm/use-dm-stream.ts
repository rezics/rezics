import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getApiConfig } from "../config";
import { dmKeys } from "./dm.keys";
import type { DmStreamEvent } from "./dm.types";

function getDmWsUrl(): string {
  const base = getApiConfig().notifyBaseUrl ?? "";
  if (!base) return "";
  if (base.startsWith("https://")) return `wss://${base.slice(8)}/dm`;
  if (base.startsWith("http://")) return `ws://${base.slice(7)}/dm`;
  return `${base}/dm`;
}

/**
 * Subscribe to notify's `WS /dm` stream — cookie-authenticated per
 * `notify-broadcast-boundary`. Each incoming event invalidates the
 * relevant cached queries (conversation list always; thread query if
 * the event targets a specific conversation) so consumers re-fetch.
 *
 * Mount this once per authenticated app shell (typically alongside
 * `useNotificationStream`). The browser handles ws reconnect on
 * transient failures; on each reconnect, the next event triggers
 * cache refresh so missed messages backfill.
 */
export function useDmStream(input?: { enabled?: boolean }): void {
  const enabled = input?.enabled ?? true;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const url = getDmWsUrl();
    if (!url) return;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }

    const onMessage = (evt: MessageEvent) => {
      let parsed: DmStreamEvent | null = null;
      try {
        parsed = JSON.parse(evt.data as string) as DmStreamEvent;
      } catch {
        parsed = null;
      }
      queryClient.invalidateQueries({ queryKey: dmKeys.conversations() });
      if (parsed && parsed.kind === "dm.message") {
        const message = (parsed as { message?: { conversationId?: string } })
          .message;
        if (message?.conversationId) {
          queryClient.invalidateQueries({
            queryKey: dmKeys.messages(message.conversationId),
          });
        }
      } else if (parsed && parsed.kind === "dm.read") {
        const conversationId = (parsed as { conversationId?: string })
          .conversationId;
        if (conversationId) {
          queryClient.invalidateQueries({
            queryKey: dmKeys.messages(conversationId),
          });
        }
      }
    };

    ws.addEventListener("message", onMessage);

    return () => {
      ws?.removeEventListener("message", onMessage);
      ws?.close();
    };
  }, [enabled, queryClient]);
}

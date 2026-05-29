import type { DmBlockState, DmReadReceipt, DmSendBody } from "@rezics/contract";
import { notifyFetch } from "../notification/notify-fetch";
import { apiFetch } from "../react-query/http";
import type {
  DmConversationListResponse,
  DmMessageListResponse,
} from "./dm.types";

/**
 * DM client surface.
 *
 * - `send` POSTs to `@rezics/server`'s `/dm/send` route, which checks
 *   the Subscription-based permission gate (engagement-subscription
 *   design D7a) and forwards to notify.
 * - `listConversations` and `listMessages` hit notify directly via
 *   cookie-authenticated `notifyFetch` (notify-broadcast-boundary
 *   established the Domain=.rezics.com cookie scope).
 */
export const dmApi = {
  send: async (input: DmSendBody): Promise<{ success: true }> => {
    return apiFetch<{ success: true }>("/dm/send", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listConversations: async (): Promise<DmConversationListResponse> => {
    return notifyFetch<DmConversationListResponse>("/dm/conversations");
  },

  listMessages: async (
    conversationId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<DmMessageListResponse> => {
    const params = new URLSearchParams();
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return notifyFetch<DmMessageListResponse>(
      `/dm/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`,
    );
  },

  markRead: async (
    conversationId: string,
    upToMessageId: string,
  ): Promise<DmReadReceipt> => {
    return notifyFetch<DmReadReceipt>(
      `/dm/conversations/${conversationId}/read`,
      { method: "POST", body: JSON.stringify({ upToMessageId }) },
    );
  },

  setTyping: async (
    conversationId: string,
    isTyping: boolean,
  ): Promise<void> => {
    await notifyFetch<{ success: true }>(
      `/dm/conversations/${conversationId}/typing`,
      { method: "POST", body: JSON.stringify({ isTyping }) },
    );
  },

  setBlock: async (peerId: string, blocked: boolean): Promise<DmBlockState> => {
    return notifyFetch<DmBlockState>("/dm/blocks", {
      method: "POST",
      body: JSON.stringify({ peerId, blocked }),
    });
  },

  getBlockState: async (peerId: string): Promise<DmBlockState> => {
    return notifyFetch<DmBlockState>(`/dm/blocks/${peerId}`);
  },
};

import type { DmBlockState, DmReadReceipt, DmSendBody } from "@rezics/contract";
import { notifyFetch } from "../notification/notify-fetch";
import { apiFetch } from "../react-query/http";
import type {
  DmConversation,
  DmConversationListResponse,
  DmMessageListResponse,
} from "./dm.types";

/**
 * DM client surface.
 *
 * - `send` POSTs to `@rezics/server`'s `/dm/send` route, which gates the
 *   send on a Subscription whose `channels` includes `'*'`, `'dm.*'`, or
 *   `'dm.message'` (sender -> recipient), then forwards to notify.
 * - `listConversations` and `listMessages` hit notify directly via
 *   cookie-authenticated `notifyFetch`; the session cookie is scoped to
 *   `Domain=.rezics.com` so it is sent cross-subdomain to notify.
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

  getConversation: async (conversationId: string): Promise<DmConversation> => {
    return notifyFetch<DmConversation>(`/dm/conversations/${conversationId}`);
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

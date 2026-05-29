import type {
  DmBlockPeerBody,
  DmBlockState,
  DmReadReceipt,
  DmSendBody,
  DmTypingIndicator,
} from "@rezics/contract";

export type {
  DmBlockPeerBody,
  DmBlockState,
  DmReadReceipt,
  DmSendBody,
  DmTypingIndicator,
};

/**
 * Conversation summary as returned by notify's `GET /dm/conversations`.
 * Frontend-first shape per CLAUDE.md — fields are optional where the
 * notify service may not yet emit them; consumers must tolerate
 * missing values.
 */
export type DmConversation = {
  id: string;
  peerId: string;
  peerName?: string;
  peerAvatar?: string | null;
  peerSlug?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  /** The viewer has blocked the peer (no new messages may be sent). */
  peerBlocked?: boolean;
  /** The peer has blocked the viewer (sending is disabled). */
  blockedByPeer?: boolean;
  updatedAt: string;
};

export type DmConversationListResponse = {
  conversations: DmConversation[];
};

export type DmMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
};

export type DmMessageListResponse = {
  messages: DmMessage[];
  nextCursor?: string | null;
};

/**
 * Incoming WS event payload from notify's `WS /dm`. The exact shape is
 * notify-side and may evolve; we keep this loose so frontend code can
 * key off `kind` and pass `event` to optimistic-update helpers.
 */
export type DmStreamEvent =
  | { kind: "dm.message"; message: DmMessage }
  | { kind: "dm.read"; conversationId: string; readAt: string }
  | {
      kind: "dm.typing";
      conversationId: string;
      userId: string;
      isTyping: boolean;
      at: string;
    }
  | { kind: "dm.block"; peerId: string; blocked: boolean }
  | { kind: string; [extra: string]: unknown };

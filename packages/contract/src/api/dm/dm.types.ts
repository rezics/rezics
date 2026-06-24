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
 * notify 的 `GET /dm/conversations` 返回的会话摘要。
 * 遵循 CLAUDE.md 的前端优先形态——当 notify 服务可能尚未发出某些字段时，
 * 这些字段为可选；消费方必须容忍缺失值。
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
  /**
   * The viewer has blocked the peer (no new messages may be sent).
   * 当前查看者已屏蔽对方（无法发送新消息）。
   */
  peerBlocked?: boolean;
  /**
   * The peer has blocked the viewer (sending is disabled).
   * 对方已屏蔽当前查看者（发送被禁用）。
   */
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
 * 来自 notify 的 `WS /dm` 的入站 WS 事件载荷。确切形态由 notify 端决定，
 * 且可能演变；我们保持其宽松，以便前端代码可以基于 `kind` 分发，
 * 并把 `event` 传给乐观更新辅助函数。
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

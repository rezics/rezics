import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";

export const dmMessageSchema = t.Object({
  id: t.String(),
  conversationId: t.String(),
  senderId: t.String(),
  content: t.String(),
  readAt: t.Nullable(t.String()),
  createdAt: t.String(),
});
export type DmMessage = (typeof dmMessageSchema)["static"];

export const dmConversationSchema = t.Object({
  id: t.String(),
  participantA: t.String(),
  participantB: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  /** Unread messages for the requesting viewer, when resolved. 已解析时，请求查看者的未读消息数。 */
  unreadCount: t.Optional(t.Integer({ minimum: 0 })),
  /** The viewer has blocked the peer (no new messages may be sent). 查看者已屏蔽对方（无法发送新消息）。 */
  peerBlocked: t.Optional(t.Boolean()),
  /** The peer has blocked the viewer (sending is disabled). 对方已屏蔽查看者（禁止发送）。 */
  blockedByPeer: t.Optional(t.Boolean()),
});
export type DmConversation = (typeof dmConversationSchema)["static"];

// ---- read receipts 已读回执 ----

export const dmReadReceiptSchema = t.Object({
  conversationId: t.String(),
  /** The participant the receipt belongs to. 该回执所属的参与者。 */
  userId: t.String(),
  /** The latest message id the participant has read. 参与者已读的最新消息 id。 */
  lastReadMessageId: t.Nullable(t.String()),
  readAt: t.String(),
});
export type DmReadReceipt = (typeof dmReadReceiptSchema)["static"];

export const dmMarkReadBodySchema = t.Object({
  conversationId: t.String(),
  /** Mark every message up to and including this id as read. 将截至并包含此 id 的所有消息标记为已读。 */
  upToMessageId: t.String(),
});
export type DmMarkReadBody = (typeof dmMarkReadBodySchema)["static"];

// ---- typing indicator 正在输入指示 ----

export const dmTypingIndicatorSchema = t.Object({
  conversationId: t.String(),
  userId: t.String(),
  isTyping: t.Boolean(),
  at: t.String(),
});
export type DmTypingIndicator = (typeof dmTypingIndicatorSchema)["static"];

export const dmTypingBodySchema = t.Object({
  conversationId: t.String(),
  isTyping: t.Boolean(),
});
export type DmTypingBody = (typeof dmTypingBodySchema)["static"];

// ---- block / unblock peer 屏蔽 / 取消屏蔽对方 ----

export const dmBlockPeerBodySchema = t.Object({
  peerId: t.String(),
  /** `true` to block, `false` to unblock. `true` 为屏蔽，`false` 为取消屏蔽。 */
  blocked: t.Boolean(),
});
export type DmBlockPeerBody = (typeof dmBlockPeerBodySchema)["static"];

export const dmBlockStateSchema = t.Object({
  peerId: t.String(),
  peerBlocked: t.Boolean(),
  blockedByPeer: t.Boolean(),
});
export type DmBlockState = (typeof dmBlockStateSchema)["static"];

export const dmConversationListResponseSchema = t.Object({
  conversations: t.Array(dmConversationSchema),
});
export type DmConversationListResponse =
  (typeof dmConversationListResponseSchema)["static"];

export const dmMessageListResponseSchema = t.Object({
  messages: t.Array(dmMessageSchema),
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
});
export type DmMessageListResponse =
  (typeof dmMessageListResponseSchema)["static"];

export const dmMessageListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  page: t.Optional(t.Numeric({ default: 1 })),
  limit: t.Optional(t.Numeric({ default: 50 })),
});
export type DmMessageListQuery = (typeof dmMessageListQuerySchema)["static"];

export const dmMessageListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  page: t.Optional(t.Numeric({ default: 1 })),
  limit: t.Optional(t.Numeric({ default: 50 })),
});
export type DmMessageListBody = (typeof dmMessageListBodySchema)["static"];

export const dmSendBodySchema = t.Object({
  recipientId: t.String(),
  content: t.String({ minLength: 1, maxLength: 5000 }),
});
export type DmSendBody = (typeof dmSendBodySchema)["static"];

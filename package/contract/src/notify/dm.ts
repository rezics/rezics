import { t } from "elysia";

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
});
export type DmConversation = (typeof dmConversationSchema)["static"];

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
  page: t.Optional(t.Numeric({ default: 1 })),
  limit: t.Optional(t.Numeric({ default: 50 })),
});
export type DmMessageListQuery =
  (typeof dmMessageListQuerySchema)["static"];

export const dmSendBodySchema = t.Object({
  recipientId: t.String(),
  content: t.String({ minLength: 1, maxLength: 5000 }),
});
export type DmSendBody = (typeof dmSendBodySchema)["static"];

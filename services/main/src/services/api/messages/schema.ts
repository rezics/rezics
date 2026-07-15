import { t } from "elysia";

import { DateTime, Uuid } from "../schema";

export const MessageCursorQuery = t.Object({
	cursor: t.Optional(t.String({ maxLength: 512 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
});

export const ConversationParams = t.Object({ conversationId: Uuid });
export const MessageParams = t.Object({ messageId: Uuid });

export const CreateConversationBody = t.Object({ participantProfileId: Uuid });
export const SendMessageBody = t.Object({
	content: t.String({ minLength: 1, maxLength: 20_000, pattern: ".*\\S.*" }),
});
export const MarkConversationReadBody = t.Object({ lastReadMessageId: Uuid });

export const ConversationResponse = t.Object({
	id: Uuid,
	otherProfileId: Uuid,
	otherUserName: t.Nullable(t.String()),
	lastMessageAt: t.Nullable(DateTime),
	lastMessage: t.Nullable(t.String()),
	unreadCount: t.Integer(),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const ConversationListResponse = t.Object({
	items: t.Array(ConversationResponse),
	nextCursor: t.Nullable(t.String()),
});

export const MessageResponse = t.Object({
	id: Uuid,
	conversationId: Uuid,
	senderProfileId: Uuid,
	content: t.Nullable(t.String()),
	deletedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const MessageListResponse = t.Object({
	items: t.Array(MessageResponse),
	nextCursor: t.Nullable(t.String()),
});

export const ReadConversationResponse = t.Object({
	conversationId: Uuid,
	lastReadMessageId: Uuid,
	readAt: DateTime,
});

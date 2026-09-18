import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";
import type { StaticDecode } from "typebox";

import session from "../../auth/session";
import { estimateCount } from "../../counts/contract";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	accountEntityBlock,
	conversation,
	conversationParticipantStat,
	conversationRead,
	message,
} from "../../database/schema";
import { authEntity } from "@rezics/schema/postgres/access/participation";
import { createNotification } from "../../notifications/service";
import { parseJsonCursor } from "../../pagination";
import { publicEntityName } from "../../participation/presentation";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { UserNotFound } from "../users/errors";
import {
	ConversationNotFound,
	ConversationParticipantsInvalid,
	DirectMessageBlocked,
	InvalidMessageCursor,
	MessageNotFound,
} from "./errors";
import {
	ConversationListResponse,
	ConversationParams,
	ConversationResponse,
	CreateConversationBody,
	MarkConversationReadBody,
	MessageCursorQuery,
	MessageListResponse,
	MessageParams,
	MessageResponse,
	ReadConversationResponse,
	SendMessageBody,
} from "./schema";

const messageSelection = {
	id: message.id,
	conversationId: message.conversationId,
	senderEntityId: message.senderEntityId,
	content: message.content,
	deletedAt: message.deletedAt,
	createdAt: message.createdAt,
	updatedAt: message.updatedAt,
};
function otherConversationEntity(authUserId: string) {
	return sql<string>`case when ${conversation.participantLowAuthUserId} = ${authUserId} then ${conversation.participantHighEntityId} else ${conversation.participantLowEntityId} end`;
}

const Cursor = t.Object(
	{
		v: t.Literal(1),
		scope: t.String({ minLength: 1 }),
		createdAt: t.String(),
		id: t.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);
type Cursor = StaticDecode<typeof Cursor>;

function encodeCursor(value: Cursor) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(value: string | undefined, scope: string) {
	if (!value) return undefined;
	try {
		const parsed = parseJsonCursor(value, Cursor);
		if (parsed.scope !== scope || Number.isNaN(Date.parse(parsed.createdAt)) || !parsed.id)
			throw new InvalidMessageCursor();
		return {
			...parsed,
			date: new Date(parsed.createdAt),
		};
	} catch {
		throw new InvalidMessageCursor();
	}
}

async function findParticipant(conversationId: string, userId: string) {
	const [row] = await database
		.select({
			low: conversation.participantLowAuthUserId,
			high: conversation.participantHighAuthUserId,
		})
		.from(conversation)
		.where(
			and(
				eq(conversation.id, conversationId),
				or(
					eq(conversation.participantLowAuthUserId, userId),
					eq(conversation.participantHighAuthUserId, userId),
				),
			),
		)
		.limit(1);
	if (!row) throw new ConversationNotFound();
	return row.low === userId ? row.high : row.low;
}

export default new Elysia({ prefix: "/messages" })
	.use(session)
	.get(
		"/conversations",
		{
			access: "message:read",
			query: MessageCursorQuery,
			response: {
				[StatusCodes.OK]: ConversationListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidMessageCursor"]),
			},
			detail: { summary: "List direct-message conversations", tags: ["Messages"] },
		},
		async ({ user, query }) => {
			const cursor = decodeCursor(query.cursor, "conversations");
			const boundary = cursor;
			const limit = query.limit ?? 30;
			const candidates = await database
				.select({
					id: conversation.id,
					otherEntityId: otherConversationEntity(user.id),
					otherUserName: publicEntityName(otherConversationEntity(user.id)),
					lastMessageAt: conversationParticipantStat.lastMessageAt,
					lastMessage: sql<string | null>`(
						select m.content from message m
						where m.id = ${conversationParticipantStat.lastMessageId}
					)`,
					unreadCount: conversationParticipantStat.unreadCount,
					aggregateUpdatedAt: conversationParticipantStat.updatedAt,
					createdAt: conversation.createdAt,
					updatedAt: conversationParticipantStat.sortAt,
					sortAt: conversationParticipantStat.sortAt,
				})
				.from(conversationParticipantStat)
				.innerJoin(conversation, eq(conversation.id, conversationParticipantStat.conversationId))
				.where(
					and(
						eq(conversationParticipantStat.authUserId, user.id),
						boundary
							? sql`(${conversationParticipantStat.sortAt} < ${boundary.date} or (${conversationParticipantStat.sortAt} = ${boundary.date} and ${conversationParticipantStat.conversationId} < ${boundary.id}))`
							: undefined,
					),
				)
				.orderBy(
					desc(conversationParticipantStat.sortAt),
					desc(conversationParticipantStat.conversationId),
				)
				.limit(limit + 1);
			const page = candidates.slice(0, limit);
			const last = page.at(-1);
			return {
				items: page.map(({ sortAt: _, aggregateUpdatedAt, ...item }) => ({
					...item,
					unreadCount: estimateCount(
						toSafeInteger(item.unreadCount, "conversation unread count"),
						aggregateUpdatedAt,
					),
				})),
				nextCursor:
					candidates.length > limit && last
						? encodeCursor({
								v: 1,
								scope: "conversations",
								createdAt: last.sortAt.toISOString(),
								id: last.id,
							})
						: null,
			};
		},
	)
	.post(
		"/conversations",
		{
			access: "write:message:write",
			body: CreateConversationBody,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["DirectMessageBlocked"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ConversationParticipantsInvalid"]),
			},
			detail: { summary: "Create or find a direct-message conversation", tags: ["Messages"] },
		},
		async ({ user, body }) =>
			database.transaction(async (tx) => {
				const [self] = await tx
					.select()
					.from(authEntity)
					.where(and(eq(authEntity.authUserId, user.id), eq(authEntity.state, "active")))
					.limit(1);
				const [target] = await tx
					.select()
					.from(authEntity)
					.where(
						and(eq(authEntity.entityId, body.participantEntityId), eq(authEntity.state, "active")),
					)
					.limit(1);
				if (!self || !target) throw new UserNotFound();
				if (self.authUserId === target.authUserId) throw new ConversationParticipantsInvalid();
				const [low, high] = self.authUserId < target.authUserId ? [self, target] : [target, self];
				const [blocked] = await tx
					.select({ id: accountEntityBlock.blockerAuthUserId })
					.from(accountEntityBlock)
					.where(
						or(
							and(
								eq(accountEntityBlock.blockerAuthUserId, self.authUserId),
								eq(accountEntityBlock.blockedEntityId, target.entityId),
							),
							and(
								eq(accountEntityBlock.blockerAuthUserId, target.authUserId),
								eq(accountEntityBlock.blockedEntityId, self.entityId),
							),
						),
					)
					.limit(1);
				if (blocked) throw new DirectMessageBlocked();
				const [created] = await tx
					.insert(conversation)
					.values({
						participantLowAuthUserId: low.authUserId,
						participantHighAuthUserId: high.authUserId,
						participantLowEntityId: low.entityId,
						participantHighEntityId: high.entityId,
					})
					.onConflictDoNothing()
					.returning({ id: conversation.id });
				if (created) return created;
				const [existing] = await tx
					.select({ id: conversation.id })
					.from(conversation)
					.where(
						and(
							eq(conversation.participantLowAuthUserId, low.authUserId),
							eq(conversation.participantHighAuthUserId, high.authUserId),
						),
					)
					.limit(1);
				if (!existing) throw new Error("Conversation insertion failed");
				return existing;
			}),
	)
	.get(
		"/conversations/:conversationId",
		{
			access: "message:read",
			params: ConversationParams,
			response: {
				[StatusCodes.OK]: ConversationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ConversationNotFound"]),
			},
			detail: { summary: "Get direct-message conversation", tags: ["Messages"] },
		},
		async ({ user, params }) => {
			await findParticipant(params.conversationId, user.id);
			const [row] = await database
				.select({
					id: conversation.id,
					otherEntityId: otherConversationEntity(user.id),
					otherUserName: publicEntityName(otherConversationEntity(user.id)),
					lastMessageAt: conversationParticipantStat.lastMessageAt,
					lastMessage: sql<string | null>`(
						select m.content from message m
						where m.id = ${conversationParticipantStat.lastMessageId}
					)`,
					unreadCount: conversationParticipantStat.unreadCount,
					aggregateUpdatedAt: conversationParticipantStat.updatedAt,
					createdAt: conversation.createdAt,
					updatedAt: conversationParticipantStat.sortAt,
				})
				.from(conversationParticipantStat)
				.innerJoin(conversation, eq(conversation.id, conversationParticipantStat.conversationId))
				.where(
					and(
						eq(conversationParticipantStat.conversationId, params.conversationId),
						eq(conversationParticipantStat.authUserId, user.id),
					),
				)
				.limit(1);
			if (!row) throw new ConversationNotFound();
			const { aggregateUpdatedAt, unreadCount, ...conversationRow } = row;
			return {
				...conversationRow,
				unreadCount: estimateCount(
					toSafeInteger(unreadCount, "conversation unread count"),
					aggregateUpdatedAt,
				),
			};
		},
	)
	.get(
		"/conversations/:conversationId/messages",
		{
			access: "message:read",
			params: ConversationParams,
			query: MessageCursorQuery,
			response: {
				[StatusCodes.OK]: MessageListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidMessageCursor"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ConversationNotFound"]),
			},
			detail: { summary: "List direct messages", tags: ["Messages"] },
		},
		async ({ user, params, query }) => {
			await findParticipant(params.conversationId, user.id);
			const cursor = decodeCursor(query.cursor, params.conversationId);
			const boundary = cursor;
			const limit = query.limit ?? 30;
			const candidates = await database
				.select(messageSelection)
				.from(message)
				.where(
					and(
						eq(message.conversationId, params.conversationId),
						boundary
							? or(
									lt(message.createdAt, boundary.date),
									and(eq(message.createdAt, boundary.date), lt(message.id, boundary.id)),
								)
							: undefined,
					),
				)
				.orderBy(desc(message.createdAt), desc(message.id))
				.limit(limit + 1);
			const items = candidates.slice(0, limit);
			const last = items.at(-1);
			return {
				items,
				nextCursor:
					candidates.length > limit && last
						? encodeCursor({
								v: 1,
								scope: params.conversationId,
								createdAt: last.createdAt.toISOString(),
								id: last.id,
							})
						: null,
			};
		},
	)
	.post(
		"/conversations/:conversationId/messages",
		{
			access: "write:message:write",
			params: ConversationParams,
			body: SendMessageBody,
			response: {
				[StatusCodes.OK]: MessageResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["DirectMessageBlocked"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ConversationNotFound"]),
			},
			detail: { summary: "Send direct message", tags: ["Messages"] },
		},
		async ({ user, params, body }) => {
			const result = await database.transaction(async (tx) => {
				const [current] = await tx
					.select({
						low: conversation.participantLowAuthUserId,
						high: conversation.participantHighAuthUserId,
						lowEntity: conversation.participantLowEntityId,
						highEntity: conversation.participantHighEntityId,
					})
					.from(conversation)
					.where(eq(conversation.id, params.conversationId))
					.limit(1);
				if (!current || !current.low || !current.high || !current.lowEntity || !current.highEntity || (current.low !== user.id && current.high !== user.id))
					throw new ConversationNotFound();
				const recipientAuthUserId = current.low === user.id ? current.high : current.low;
				const senderEntityId = current.low === user.id ? current.lowEntity : current.highEntity;
				const recipientEntityId = current.low === user.id ? current.highEntity : current.lowEntity;
				const [blocked] = await tx
					.select({ id: accountEntityBlock.blockerAuthUserId })
					.from(accountEntityBlock)
					.where(
						or(
							and(
								eq(accountEntityBlock.blockerAuthUserId, user.id),
								eq(accountEntityBlock.blockedEntityId, recipientEntityId),
							),
							and(
								eq(accountEntityBlock.blockerAuthUserId, recipientAuthUserId),
								eq(accountEntityBlock.blockedEntityId, senderEntityId),
							),
						),
					)
					.limit(1);
				if (blocked) throw new DirectMessageBlocked();
				const [created] = await tx
					.insert(message)
					.values({
						conversationId: params.conversationId,
						senderAuthUserId: user.id,
						senderEntityId,
						content: body.content.trim(),
					})
					.returning(messageSelection);
				if (!created) throw new Error("Message insert did not return a row");
				await createNotification(tx, {
					recipientAuthUserId,
					actorProfileId: senderEntityId,
					kind: "direct_message",
					payload: {
						type: "direct_message",
						conversationId: params.conversationId,
						messageId: created.id,
					},
				});
				return created;
			});
			return result;
		},
	)
	.put(
		"/conversations/:conversationId/read",
		{
			access: "write:message:write",
			params: ConversationParams,
			body: MarkConversationReadBody,
			response: {
				[StatusCodes.OK]: ReadConversationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ConversationNotFound", "MessageNotFound"]),
			},
			detail: { summary: "Mark direct-message conversation read", tags: ["Messages"] },
		},
		async ({ user, params, body }) => {
			const now = await database.transaction(async (tx) => {
				const [participant] = await tx
					.select({
						conversationId: conversationParticipantStat.conversationId,
						lastMessageId: conversationParticipantStat.lastMessageId,
					})
					.from(conversationParticipantStat)
					.where(
						and(
							eq(conversationParticipantStat.conversationId, params.conversationId),
							eq(conversationParticipantStat.authUserId, user.id),
						),
					)
					.for("update")
					.limit(1);
				if (!participant) throw new ConversationNotFound();
				// Marking a conversation read is intentionally a latest-message operation. The
				// participant row is locked, so the unread counter can be reset in O(1) while
				// concurrent sends wait and subsequently apply their own +1 delta.
				if (participant.lastMessageId !== body.lastReadMessageId) throw new MessageNotFound(true);
				const [lastMessage] = await tx
					.select({ id: message.id })
					.from(message)
					.where(
						and(
							eq(message.id, body.lastReadMessageId),
							eq(message.conversationId, params.conversationId),
						),
					)
					.limit(1);
				if (!lastMessage) throw new MessageNotFound(true);
				const readAt = new Date();
				await tx
					.insert(conversationRead)
					.values({
						conversationId: params.conversationId,
						authUserId: user.id,
						lastReadMessageId: body.lastReadMessageId,
						readAt,
					})
					.onConflictDoUpdate({
						target: [conversationRead.conversationId, conversationRead.authUserId],
						set: { lastReadMessageId: body.lastReadMessageId, readAt },
					});
				await tx
					.update(conversationParticipantStat)
					.set({ unreadCount: 0n, updatedAt: readAt })
					.where(
						and(
							eq(conversationParticipantStat.conversationId, params.conversationId),
							eq(conversationParticipantStat.authUserId, user.id),
						),
					);
				return readAt;
			});
			return {
				conversationId: params.conversationId,
				lastReadMessageId: body.lastReadMessageId,
				readAt: now,
			};
		},
	)
	.delete(
		"/:messageId",
		{
			access: "write:message:write",
			params: MessageParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["MessageNotFound"]),
			},
			detail: {
				summary: "Delete direct message",
				tags: ["Messages"],
				responses: NoContentResponse,
			},
		},
		async ({ user, params }) => {
			const [deleted] = await database
				.update(message)
				.set({ content: null, deletedAt: new Date() })
				.where(
					and(
						eq(message.id, params.messageId),
						eq(message.senderAuthUserId, user.id),
						isNull(message.deletedAt),
					),
				)
				.returning({ id: message.id });
			if (!deleted) throw new MessageNotFound();
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	);

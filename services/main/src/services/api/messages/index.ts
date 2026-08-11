import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import { estimateCount } from "../../counts/contract";
import { firstUnitLocalizationTitle } from "../../units/localization";
import {
	conversation,
	conversationParticipantStat,
	conversationRead,
	message,
	unit,
	profile as profileTable,
	profileBlock,
} from "../../database/schema";
import { createNotification } from "../../notifications/service";
import { parseJsonCursor } from "../../pagination";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
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
import { UserNotFound } from "../users/errors";
import {
	ConversationNotFound,
	ConversationParticipantsInvalid,
	DirectMessageBlocked,
	InvalidMessageCursor,
	MessageNotFound,
} from "./errors";

const Cursor = t.Object(
	{
		v: t.Literal(1),
		scope: t.String({ minLength: 1 }),
		createdAt: t.String(),
		id: t.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);
type Cursor = typeof Cursor.static;

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
			low: conversation.participantLowProfileId,
			high: conversation.participantHighProfileId,
		})
		.from(conversation)
		.where(
			and(
				eq(conversation.id, conversationId),
				or(
					eq(conversation.participantLowProfileId, userId),
					eq(conversation.participantHighProfileId, userId),
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
		async ({ profile, query }) => {
			const cursor = decodeCursor(query.cursor, "conversations");
			const boundary = cursor;
			const limit = query.limit ?? 30;
			const candidates = await database
				.select({
					id: conversation.id,
					otherProfileId: sql<string>`case when ${conversation.participantLowProfileId} = ${profile.unitId} then ${conversation.participantHighProfileId} else ${conversation.participantLowProfileId} end`,
					otherUserName: sql<string | null>`(
						select p.name from profile p
						where p.id = case when ${conversation.participantLowProfileId} = ${profile.unitId} then ${conversation.participantHighProfileId} else ${conversation.participantLowProfileId} end
					)`,
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
				.innerJoin(
					conversation,
					eq(conversation.id, conversationParticipantStat.conversationId),
				)
				.where(
					and(
						eq(conversationParticipantStat.profileId, profile.unitId),
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
		{
			access: "message:read",
			query: MessageCursorQuery,
			response: {
				[StatusCodes.OK]: ConversationListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidMessageCursor"]),
			},
			detail: { summary: "List direct-message conversations", tags: ["Messages"] },
		},
	)
	.post(
		"/conversations",
		async ({ profile, body }) => {
			if (body.participantProfileId === profile.unitId)
				throw new ConversationParticipantsInvalid();
			const [target] = await database
				.select({ id: profileTable.id })
				.from(profileTable)
				.innerJoin(unit, eq(unit.id, profileTable.id))
				.where(
					and(
						eq(profileTable.id, body.participantProfileId),
						eq(unit.status, "published"),
					),
				)
				.limit(1);
			if (!target) throw new UserNotFound();
			const [low, high] =
				profile.unitId < body.participantProfileId
					? [profile.unitId, body.participantProfileId]
					: [body.participantProfileId, profile.unitId];
			const id = await database.transaction(async (tx) => {
				const [blocked] = await tx
					.select({ id: profileBlock.blockerProfileId })
					.from(profileBlock)
					.where(
						or(
							and(
								eq(profileBlock.blockerProfileId, low),
								eq(profileBlock.blockedProfileId, high),
							),
							and(
								eq(profileBlock.blockerProfileId, high),
								eq(profileBlock.blockedProfileId, low),
							),
						),
					)
					.limit(1);
				if (blocked) throw new DirectMessageBlocked();
				const [created] = await tx
					.insert(conversation)
					.values({ participantLowProfileId: low, participantHighProfileId: high })
					.onConflictDoNothing()
					.returning({ id: conversation.id });
				if (created) return created.id;
				const [existing] = await tx
					.select({ id: conversation.id })
					.from(conversation)
					.where(
						and(
							eq(conversation.participantLowProfileId, low),
							eq(conversation.participantHighProfileId, high),
						),
					)
					.limit(1);
				if (!existing) throw new Error("Conversation upsert did not return a row");
				return existing.id;
			});
			return { id };
		},
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
	)
	.get(
		"/conversations/:conversationId",
		async ({ profile, params }) => {
			const otherProfileId = await findParticipant(params.conversationId, profile.unitId);
			const [row] = await database
				.select({
					id: conversation.id,
					otherProfileId: sql<string>`${otherProfileId}`,
					otherUserName: firstUnitLocalizationTitle(profileTable.id),
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
				.innerJoin(
					conversation,
					eq(conversation.id, conversationParticipantStat.conversationId),
				)
				.innerJoin(profileTable, eq(profileTable.id, otherProfileId))
				.where(
					and(
						eq(conversationParticipantStat.conversationId, params.conversationId),
						eq(conversationParticipantStat.profileId, profile.unitId),
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
		{
			access: "message:read",
			params: ConversationParams,
			response: {
				[StatusCodes.OK]: ConversationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ConversationNotFound"]),
			},
			detail: { summary: "Get direct-message conversation", tags: ["Messages"] },
		},
	)
	.get(
		"/conversations/:conversationId/messages",
		async ({ profile, params, query }) => {
			await findParticipant(params.conversationId, profile.unitId);
			const cursor = decodeCursor(query.cursor, params.conversationId);
			const boundary = cursor;
			const limit = query.limit ?? 30;
			const candidates = await database
				.select()
				.from(message)
				.where(
					and(
						eq(message.conversationId, params.conversationId),
						boundary
							? or(
									lt(message.createdAt, boundary.date),
									and(
										eq(message.createdAt, boundary.date),
										lt(message.id, boundary.id),
									),
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
	)
	.post(
		"/conversations/:conversationId/messages",
		async ({ profile, params, body }) => {
			const result = await database.transaction(async (tx) => {
				const [current] = await tx
					.select({
						low: conversation.participantLowProfileId,
						high: conversation.participantHighProfileId,
					})
					.from(conversation)
					.where(eq(conversation.id, params.conversationId))
					.limit(1);
				if (!current || (current.low !== profile.unitId && current.high !== profile.unitId))
					throw new ConversationNotFound();
				const recipientProfileId =
					current.low === profile.unitId ? current.high : current.low;
				const [blocked] = await tx
					.select({ id: profileBlock.blockerProfileId })
					.from(profileBlock)
					.where(
						or(
							and(
								eq(profileBlock.blockerProfileId, profile.unitId),
								eq(profileBlock.blockedProfileId, recipientProfileId),
							),
							and(
								eq(profileBlock.blockerProfileId, recipientProfileId),
								eq(profileBlock.blockedProfileId, profile.unitId),
							),
						),
					)
					.limit(1);
				if (blocked) throw new DirectMessageBlocked();
				const [created] = await tx
					.insert(message)
					.values({
						conversationId: params.conversationId,
						senderProfileId: profile.unitId,
						content: body.content.trim(),
					})
					.returning();
				if (!created) throw new Error("Message insert did not return a row");
				await createNotification(tx, {
					recipientProfileId: recipientProfileId,
					actorProfileId: profile.unitId,
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
	)
	.put(
		"/conversations/:conversationId/read",
		async ({ profile, params, body }) => {
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
							eq(conversationParticipantStat.profileId, profile.unitId),
						),
					)
					.for("update")
					.limit(1);
				if (!participant) throw new ConversationNotFound();
				// Marking a conversation read is intentionally a latest-message operation. The
				// participant row is locked, so the unread counter can be reset in O(1) while
				// concurrent sends wait and subsequently apply their own +1 delta.
				if (participant.lastMessageId !== body.lastReadMessageId)
					throw new MessageNotFound(true);
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
						profileId: profile.unitId,
						lastReadMessageId: body.lastReadMessageId,
						readAt,
					})
					.onConflictDoUpdate({
						target: [conversationRead.conversationId, conversationRead.profileId],
						set: { lastReadMessageId: body.lastReadMessageId, readAt },
					});
				await tx
					.update(conversationParticipantStat)
					.set({ unreadCount: 0n, updatedAt: readAt })
					.where(
						and(
							eq(conversationParticipantStat.conversationId, params.conversationId),
							eq(conversationParticipantStat.profileId, profile.unitId),
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
		{
			access: "write:message:write",
			params: ConversationParams,
			body: MarkConversationReadBody,
			response: {
				[StatusCodes.OK]: ReadConversationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"ConversationNotFound",
					"MessageNotFound",
				]),
			},
			detail: { summary: "Mark direct-message conversation read", tags: ["Messages"] },
		},
	)
	.delete(
		"/:messageId",
		async ({ profile, params }) => {
			const [deleted] = await database
				.update(message)
				.set({ content: null, deletedAt: new Date() })
				.where(
					and(
						eq(message.id, params.messageId),
						eq(message.senderProfileId, profile.unitId),
						isNull(message.deletedAt),
					),
				)
				.returning({ id: message.id });
			if (!deleted) throw new MessageNotFound();
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
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
	);

import type { StaticDecode } from "typebox";
import { StatusCodes } from "http-status-codes";
import { Check } from "typebox/value";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia, { t } from "elysia";
import { toUiLocale } from "@rezics/i18n";

import session from "../../auth/session";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import { estimateCount } from "../../counts/contract";
import { firstUnitLocalizationTitle } from "../../units/localization";
import {
	contentReport,
	conversation,
	notification,
	notificationPreference,
	notificationRecipientStat,
	profile as profileTable,
	profilePreference,
	unit,
	unitAccessInvitation,
} from "../../database/schema";
import type { UnitKind } from "../../database/schema/contract-values";
import { emailIntentDeliveryEnabled } from "../../email/policy";
import i18n from "../../i18n";
import { DefaultStoredUiLocale } from "../../database/schema/contract-values";
import { parseJsonCursor } from "../../pagination";
import { notificationTranslationKey } from "../../notifications/service";
import { getPublicCanonicalUnitSlugAddresses } from "../../units/slug-address";
import { toApiErrorResponse } from "../schema/response";
import { InvalidNotificationCursor, NotificationNotFound } from "./errors";
import {
	DirectMessageNotificationPayload,
	ModerationNotificationPayload,
	NotificationCursorQuery,
	NotificationItemResponse,
	NotificationListResponse,
	NotificationParams,
	NotificationPreferencesResponse,
	ReadNotificationResponse,
	ReadNotificationsBody,
	RealmNotificationPayload,
	ReplaceNotificationPreferencesBody,
	SystemNotificationPayload,
	UnreadCountResponse,
} from "./schema";

const NotificationCursor = t.Object(
	{
		v: t.Literal(1),
		createdAt: t.String(),
		id: t.String({ minLength: 1 }),
		unreadOnly: t.Boolean(),
	},
	{ additionalProperties: false },
);
type NotificationCursor = StaticDecode<typeof NotificationCursor>;

const preferenceKinds = [
	"reply",
	"new_follower",
	"direct_message",
	"moderation",
	"realm",
	"system",
] as const;
const notificationEmailDeliveryEnabled = emailIntentDeliveryEnabled("notification");
const notificationActor = alias(profileTable, "notification_actor");
const notificationSubject = alias(unit, "notification_subject");

function notificationRecipientMutationLockName(profileId: string): string {
	return `notification-recipient:${profileId}`;
}

type NotificationCandidate = {
	readonly id: string;
	readonly kind: (typeof notification.$inferSelect)["kind"];
	readonly actorProfileId: string | null;
	readonly actorName: string | null;
	readonly subjectUnitId: string | null;
	readonly subjectUnitKind: UnitKind | null;
	readonly payload: (typeof notification.$inferSelect)["payload"];
	readonly physicalReadAt: Date | null;
	readonly readThroughCreatedAt: Date | null;
	readonly readThroughId: string | null;
	readonly readThroughAt: Date | null;
	readonly createdAt: Date;
};

type UnavailableContext = { readonly type: "unavailable" };
type PresentedContext =
	| {
			readonly kind: "reply";
			readonly context: { readonly type: "reply" } | UnavailableContext;
	  }
	| {
			readonly kind: "new_follower";
			readonly context: { readonly type: "new_follower" } | UnavailableContext;
	  }
	| {
			readonly kind: "direct_message";
			readonly context: StaticDecode<typeof DirectMessageNotificationPayload> | UnavailableContext;
	  }
	| {
			readonly kind: "moderation";
			readonly context: StaticDecode<typeof ModerationNotificationPayload> | UnavailableContext;
	  }
	| {
			readonly kind: "realm";
			readonly context: StaticDecode<typeof RealmNotificationPayload> | UnavailableContext;
	  }
	| {
			readonly kind: "system";
			readonly context: StaticDecode<typeof SystemNotificationPayload> | UnavailableContext;
	  };

function encodeCursor(cursor: NotificationCursor) {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | undefined, unreadOnly: boolean) {
	if (!value) return undefined;
	try {
		const parsed = parseJsonCursor(value, NotificationCursor);
		if (
			parsed.unreadOnly !== unreadOnly ||
			Number.isNaN(Date.parse(parsed.createdAt)) ||
			!parsed.id
		)
			throw new InvalidNotificationCursor();
		return {
			...parsed,
			date: new Date(parsed.createdAt),
		};
	} catch {
		throw new InvalidNotificationCursor();
	}
}

function presentNotificationContext(
	kind: (typeof notification.$inferSelect)["kind"],
	payload: (typeof notification.$inferSelect)["payload"],
): PresentedContext {
	const unavailable = { type: "unavailable" } as const;
	switch (kind) {
		case "reply":
			return {
				kind,
				context: payload === null ? { type: "reply" } : unavailable,
			};
		case "new_follower":
			return {
				kind,
				context: payload === null ? { type: "new_follower" } : unavailable,
			};
		case "direct_message":
			return {
				kind,
				context: Check(DirectMessageNotificationPayload, payload) ? payload : unavailable,
			};
		case "moderation":
			return {
				kind,
				context: Check(ModerationNotificationPayload, payload) ? payload : unavailable,
			};
		case "realm":
			return {
				kind,
				context: Check(RealmNotificationPayload, payload) ? payload : unavailable,
			};
		case "system":
			return {
				kind,
				context: Check(SystemNotificationPayload, payload) ? payload : unavailable,
			};
	}
}

function isAtOrBeforeReadThrough(candidate: NotificationCandidate): boolean {
	if (!candidate.readThroughCreatedAt || !candidate.readThroughId) return false;
	const createdDifference =
		candidate.createdAt.getTime() - candidate.readThroughCreatedAt.getTime();
	return (
		createdDifference < 0 || (createdDifference === 0 && candidate.id <= candidate.readThroughId)
	);
}

function effectiveReadAt(candidate: NotificationCandidate): Date | null {
	if (candidate.physicalReadAt) return candidate.physicalReadAt;
	return isAtOrBeforeReadThrough(candidate) ? candidate.readThroughAt : null;
}

function laterTuple(
	left: { readonly createdAt: Date; readonly id: string },
	right: { readonly createdAt: Date; readonly id: string },
): boolean {
	const createdDifference = left.createdAt.getTime() - right.createdAt.getTime();
	return createdDifference > 0 || (createdDifference === 0 && left.id > right.id);
}

async function hydrateNotifications(
	candidates: readonly NotificationCandidate[],
	profileId: string,
	copyFor: (
		kind: (typeof notification.$inferSelect)["kind"],
		payload: (typeof notification.$inferSelect)["payload"],
	) => { readonly title: string; readonly body: string },
) {
	const presented = candidates.map((candidate) => ({
		candidate,
		presented: presentNotificationContext(candidate.kind, candidate.payload),
	}));
	const unitIds = candidates.flatMap((candidate) =>
		[candidate.actorProfileId, candidate.subjectUnitId].filter(
			(value): value is string => value !== null,
		),
	);
	const conversationIds = presented.flatMap(({ presented: value }) =>
		value.kind === "direct_message" && value.context.type === "direct_message"
			? [value.context.conversationId]
			: [],
	);
	const reportIds = presented.flatMap(({ presented: value }) =>
		value.kind === "moderation" && value.context.type === "report_resolution"
			? [value.context.reportId]
			: [],
	);
	const invitationIds = presented.flatMap(({ presented: value }) =>
		value.kind === "system" &&
		value.context.type === "system_event" &&
		value.context.event === "unit_access_invitation"
			? [value.context.references.invitationId]
			: [],
	);
	const [slugAddresses, conversationRows, reportRows, invitationRows] = await Promise.all([
		getPublicCanonicalUnitSlugAddresses(unitIds),
		conversationIds.length
			? database
					.select({ id: conversation.id })
					.from(conversation)
					.where(
						and(
							inArray(conversation.id, [...new Set(conversationIds)]),
							or(
								eq(conversation.participantLowProfileId, profileId),
								eq(conversation.participantHighProfileId, profileId),
							),
						),
					)
			: Promise.resolve([]),
		reportIds.length
			? database
					.select({ id: contentReport.id })
					.from(contentReport)
					.where(
						and(
							inArray(contentReport.id, [...new Set(reportIds)]),
							eq(contentReport.reporterProfileId, profileId),
						),
					)
			: Promise.resolve([]),
		invitationIds.length
			? database
					.select({ id: unitAccessInvitation.id, unitId: unitAccessInvitation.unitId })
					.from(unitAccessInvitation)
					.where(
						and(
							inArray(unitAccessInvitation.id, [...new Set(invitationIds)]),
							eq(unitAccessInvitation.invitedProfileId, profileId),
						),
					)
			: Promise.resolve([]),
	]);
	const availableConversations = new Set(conversationRows.map(({ id }) => id));
	const availableReports = new Set(reportRows.map(({ id }) => id));
	const availableInvitations = new Map(invitationRows.map((row) => [row.id, row.unitId]));

	return presented.map(({ candidate, presented: value }) => {
		const actor = candidate.actorProfileId
			? {
					id: candidate.actorProfileId,
					name: candidate.actorName,
					slugAddress: slugAddresses.get(candidate.actorProfileId) ?? null,
				}
			: null;
		const subject =
			candidate.subjectUnitId && candidate.subjectUnitKind
				? {
						id: candidate.subjectUnitId,
						kind: candidate.subjectUnitKind,
						slugAddress: slugAddresses.get(candidate.subjectUnitId) ?? null,
					}
				: null;
		const detailsDestination = {
			kind: "notification_details" as const,
			notificationId: candidate.id,
		};
		const base = {
			id: candidate.id,
			...copyFor(candidate.kind, candidate.payload),
			actor,
			subject,
			readAt: effectiveReadAt(candidate),
			createdAt: candidate.createdAt,
		};
		switch (value.kind) {
			case "reply": {
				const destination =
					value.context.type === "reply" && subject?.kind === "post"
						? { kind: "post" as const, postId: subject.id }
						: detailsDestination;
				return { ...base, ...value, destination };
			}
			case "new_follower": {
				const destination =
					value.context.type === "new_follower" && actor
						? ({
								kind: "profile",
								profile: { id: actor.id, slugAddress: actor.slugAddress },
							} as const)
						: detailsDestination;
				return { ...base, ...value, destination };
			}
			case "direct_message": {
				const destination =
					value.context.type === "direct_message" &&
					availableConversations.has(value.context.conversationId)
						? ({
								kind: "conversation",
								conversationId: value.context.conversationId,
								...(value.context.messageId ? { messageId: value.context.messageId } : {}),
							} as const)
						: detailsDestination;
				return { ...base, ...value, destination };
			}
			case "moderation": {
				const destination =
					value.context.type === "report_resolution" && availableReports.has(value.context.reportId)
						? { kind: "report" as const, reportId: value.context.reportId }
						: detailsDestination;
				return { ...base, ...value, destination };
			}
			case "realm": {
				const destination =
					value.context.type === "realm_event" && subject?.kind === "realm"
						? ({
								kind: "realm",
								realm: { id: subject.id, slugAddress: subject.slugAddress },
							} as const)
						: detailsDestination;
				return { ...base, ...value, destination };
			}
			case "system": {
				let destination:
					| typeof detailsDestination
					| {
							readonly kind: "access_invitation";
							readonly unitId: string;
							readonly invitationId: string;
					  }
					| { readonly kind: "unit"; readonly unit: NonNullable<typeof subject> } =
					detailsDestination;
				if (value.context.type !== "system_event") return { ...base, ...value, destination };
				if (value.context.event === "unit_access_invitation" && subject) {
					const invitationId = value.context.references.invitationId;
					if (availableInvitations.get(invitationId) === subject.id)
						destination = {
							kind: "access_invitation",
							unitId: subject.id,
							invitationId,
						};
				} else if (subject) destination = { kind: "unit", unit: subject };
				return { ...base, ...value, destination };
			}
		}
	});
}

function notificationSelection() {
	return {
		id: notification.id,
		kind: notification.kind,
		actorProfileId: notification.actorProfileId,
		actorName: firstUnitLocalizationTitle(notificationActor.id),
		subjectUnitId: notification.subjectUnitId,
		subjectUnitKind: notificationSubject.kind,
		payload: notification.payload,
		physicalReadAt: notification.readAt,
		readThroughCreatedAt: notificationRecipientStat.readThroughCreatedAt,
		readThroughId: notificationRecipientStat.readThroughId,
		readThroughAt: notificationRecipientStat.readThroughAt,
		createdAt: notification.createdAt,
	};
}

const afterReadThrough = or(
	isNull(notificationRecipientStat.readThroughCreatedAt),
	gt(notification.createdAt, notificationRecipientStat.readThroughCreatedAt),
	and(
		eq(notification.createdAt, notificationRecipientStat.readThroughCreatedAt),
		gt(notification.id, notificationRecipientStat.readThroughId),
	),
);

async function loadRecipientLocale(profileId: string) {
	const [preference] = await database
		.select({ interfaceLocale: profilePreference.interfaceLocale })
		.from(profilePreference)
		.where(eq(profilePreference.profileId, profileId))
		.limit(1);
	return toUiLocale(preference?.interfaceLocale ?? DefaultStoredUiLocale);
}

export default new Elysia({ prefix: "/notifications" })
	.use(session)
	.use(i18n)
	.get(
		"",
		{
			access: "notification:read",
			query: NotificationCursorQuery,
			response: {
				[StatusCodes.OK]: NotificationListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidNotificationCursor"]),
			},
			detail: { summary: "Poll notifications with a cursor", tags: ["Notifications"] },
		},
		async ({ i18n, profile, query }) => {
			const unreadOnly = Boolean(query.unreadOnly);
			const direction = query.direction ?? "before";
			const cursor = decodeCursor(query.cursor, unreadOnly);
			const [locale, unread] = await Promise.all([
				loadRecipientLocale(profile.unitId),
				database
					.select({
						value: notificationRecipientStat.unreadCount,
						updatedAt: notificationRecipientStat.updatedAt,
					})
					.from(notificationRecipientStat)
					.where(eq(notificationRecipientStat.profileId, profile.unitId))
					.limit(1)
					.then((rows) => rows[0]),
			]);
			const { t: translations } = await i18n.getTranslation("notifications", [locale]);
			const tupleCondition = cursor
				? direction === "after"
					? or(
							gt(notification.createdAt, cursor.date),
							and(eq(notification.createdAt, cursor.date), gt(notification.id, cursor.id)),
						)
					: or(
							lt(notification.createdAt, cursor.date),
							and(eq(notification.createdAt, cursor.date), lt(notification.id, cursor.id)),
						)
				: undefined;
			const limit = query.limit ?? 30;
			const candidates = await database
				.select(notificationSelection())
				.from(notification)
				.leftJoin(notificationActor, eq(notificationActor.id, notification.actorProfileId))
				.leftJoin(notificationSubject, eq(notificationSubject.id, notification.subjectUnitId))
				.leftJoin(
					notificationRecipientStat,
					eq(notificationRecipientStat.profileId, notification.recipientProfileId),
				)
				.where(
					and(
						eq(notification.recipientProfileId, profile.unitId),
						eq(notification.inAppVisible, true),
						unreadOnly ? and(isNull(notification.readAt), afterReadThrough) : undefined,
						tupleCondition,
					),
				)
				.orderBy(
					direction === "after" ? asc(notification.createdAt) : desc(notification.createdAt),
					direction === "after" ? asc(notification.id) : desc(notification.id),
				)
				.limit(limit + 1);
			const page = candidates.slice(0, limit);
			const items = await hydrateNotifications(
				page,
				profile.unitId,
				(kind, payload) => translations[notificationTranslationKey(kind, payload)],
			);
			const newest = direction === "after" ? page.at(-1) : page[0];
			const last = page.at(-1);
			return {
				items,
				nextCursor:
					candidates.length > limit && last
						? encodeCursor({
								v: 1,
								createdAt: last.createdAt.toISOString(),
								id: last.id,
								unreadOnly,
							})
						: null,
				pollCursor: newest
					? encodeCursor({
							v: 1,
							createdAt: newest.createdAt.toISOString(),
							id: newest.id,
							unreadOnly,
						})
					: (query.cursor ?? null),
				unreadCount: estimateCount(
					toSafeInteger(unread?.value ?? 0n, "notification unread count"),
					unread?.updatedAt ?? new Date(),
				),
			};
		},
	)
	.get(
		"/unread-count",
		{
			access: "notification:read",
			response: { [StatusCodes.OK]: UnreadCountResponse },
			detail: { summary: "Get unread notification count", tags: ["Notifications"] },
		},
		async ({ profile }) => {
			const [row] = await database
				.select({
					value: notificationRecipientStat.unreadCount,
					updatedAt: notificationRecipientStat.updatedAt,
				})
				.from(notificationRecipientStat)
				.where(eq(notificationRecipientStat.profileId, profile.unitId))
				.limit(1);
			return {
				count: estimateCount(
					toSafeInteger(row?.value ?? 0n, "notification unread count"),
					row?.updatedAt ?? new Date(),
				),
			};
		},
	)
	.get(
		"/:notificationId",
		{
			access: "notification:read",
			params: NotificationParams,
			response: {
				[StatusCodes.OK]: NotificationItemResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["NotificationNotFound"]),
			},
			detail: { summary: "Get one notification", tags: ["Notifications"] },
		},
		async ({ i18n, profile, params }) => {
			const locale = await loadRecipientLocale(profile.unitId);
			const { t: translations } = await i18n.getTranslation("notifications", [locale]);
			const [candidate] = await database
				.select(notificationSelection())
				.from(notification)
				.leftJoin(notificationActor, eq(notificationActor.id, notification.actorProfileId))
				.leftJoin(notificationSubject, eq(notificationSubject.id, notification.subjectUnitId))
				.leftJoin(
					notificationRecipientStat,
					eq(notificationRecipientStat.profileId, notification.recipientProfileId),
				)
				.where(
					and(
						eq(notification.id, params.notificationId),
						eq(notification.recipientProfileId, profile.unitId),
						eq(notification.inAppVisible, true),
					),
				)
				.limit(1);
			if (!candidate) throw new NotificationNotFound();
			const [item] = await hydrateNotifications(
				[candidate],
				profile.unitId,
				(kind, payload) => translations[notificationTranslationKey(kind, payload)],
			);
			if (!item) throw new NotificationNotFound();
			return item;
		},
	)
	.put(
		"/read-all",
		{
			access: "write:notification:write",
			body: ReadNotificationsBody,
			response: {
				[StatusCodes.OK]: ReadNotificationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidNotificationCursor"]),
			},
			detail: { summary: "Mark notifications read", tags: ["Notifications"] },
		},
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(profile.unitId, [["notification-preferences"]]);
			const through = decodeCursor(body.through, false);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${notificationRecipientMutationLockName(profile.unitId)}::text, 0))`,
				);
				await tx
					.insert(notificationRecipientStat)
					.values({ profileId: profile.unitId })
					.onConflictDoNothing();
				const [state] = await tx
					.select({
						readThroughCreatedAt: notificationRecipientStat.readThroughCreatedAt,
						readThroughId: notificationRecipientStat.readThroughId,
						readThroughAt: notificationRecipientStat.readThroughAt,
					})
					.from(notificationRecipientStat)
					.where(eq(notificationRecipientStat.profileId, profile.unitId))
					.for("update")
					.limit(1);
				if (!state) throw new Error("Notification recipient state was not initialized");
				const [newest] = await tx
					.select({ id: notification.id, createdAt: notification.createdAt })
					.from(notification)
					.where(
						and(
							eq(notification.recipientProfileId, profile.unitId),
							eq(notification.inAppVisible, true),
						),
					)
					.orderBy(desc(notification.createdAt), desc(notification.id))
					.limit(1);
				let target = newest;
				if (through) {
					const [boundary] = await tx
						.select({ id: notification.id, createdAt: notification.createdAt })
						.from(notification)
						.where(
							and(
								eq(notification.id, through.id),
								eq(notification.createdAt, through.date),
								eq(notification.recipientProfileId, profile.unitId),
								eq(notification.inAppVisible, true),
							),
						)
						.limit(1);
					if (!boundary) throw new InvalidNotificationCursor();
					target = boundary;
				}
				if (!target) {
					if (!through)
						await tx
							.update(notificationRecipientStat)
							.set({ unreadCount: 0n, updatedAt: sql`clock_timestamp()` })
							.where(eq(notificationRecipientStat.profileId, profile.unitId));
					return { updated: false, readAt: state.readThroughAt };
				}
				const existing =
					state.readThroughCreatedAt && state.readThroughId
						? { createdAt: state.readThroughCreatedAt, id: state.readThroughId }
						: null;
				if (existing && !laterTuple(target, existing))
					return { updated: false, readAt: state.readThroughAt };
				const reachesNewest = !newest || !laterTuple(newest, target);
				const [updated] = await tx
					.update(notificationRecipientStat)
					.set({
						readThroughCreatedAt: target.createdAt,
						readThroughId: target.id,
						readThroughAt: sql`greatest(clock_timestamp(), ${target.createdAt})`,
						...(reachesNewest ? { unreadCount: 0n } : {}),
						updatedAt: sql`clock_timestamp()`,
					})
					.where(eq(notificationRecipientStat.profileId, profile.unitId))
					.returning({ readAt: notificationRecipientStat.readThroughAt });
				if (!updated) throw new Error("Notification read-through update returned no row");
				return { updated: true, readAt: updated.readAt };
			});
		},
	)
	.put(
		"/:notificationId/read",
		{
			access: "write:notification:write",
			params: NotificationParams,
			response: {
				[StatusCodes.OK]: ReadNotificationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["NotificationNotFound"]),
			},
			detail: { summary: "Mark one notification read", tags: ["Notifications"] },
		},
		async ({ profile, params }) =>
			database.transaction(async (tx) => {
				const [current] = await tx
					.select({
						id: notification.id,
						createdAt: notification.createdAt,
						readAt: notification.readAt,
					})
					.from(notification)
					.where(
						and(
							eq(notification.id, params.notificationId),
							eq(notification.recipientProfileId, profile.unitId),
							eq(notification.inAppVisible, true),
						),
					)
					.for("update")
					.limit(1);
				if (!current) throw new NotificationNotFound();
				await tx
					.insert(notificationRecipientStat)
					.values({ profileId: profile.unitId })
					.onConflictDoNothing();
				const [state] = await tx
					.select({
						readThroughCreatedAt: notificationRecipientStat.readThroughCreatedAt,
						readThroughId: notificationRecipientStat.readThroughId,
						readThroughAt: notificationRecipientStat.readThroughAt,
					})
					.from(notificationRecipientStat)
					.where(eq(notificationRecipientStat.profileId, profile.unitId))
					.for("update")
					.limit(1);
				if (!state) throw new Error("Notification recipient state was not initialized");
				if (current.readAt) return { updated: false, readAt: current.readAt };
				const coveredByReadThrough =
					state.readThroughCreatedAt && state.readThroughId
						? !laterTuple(current, {
								createdAt: state.readThroughCreatedAt,
								id: state.readThroughId,
							})
						: false;
				if (coveredByReadThrough) return { updated: false, readAt: state.readThroughAt };
				const [updated] = await tx
					.update(notification)
					.set({ readAt: sql`greatest(clock_timestamp(), ${current.createdAt})` })
					.where(and(eq(notification.id, current.id), isNull(notification.readAt)))
					.returning({ readAt: notification.readAt });
				if (!updated?.readAt) throw new Error("Notification read update returned no timestamp");
				return { updated: true, readAt: updated.readAt };
			}),
	)
	.get(
		"/preferences",
		{
			access: "notification:read",
			response: { [StatusCodes.OK]: NotificationPreferencesResponse },
			detail: { summary: "Get notification preferences", tags: ["Notifications"] },
		},
		async ({ profile }) => {
			const rows = await database
				.select()
				.from(notificationPreference)
				.where(eq(notificationPreference.profileId, profile.unitId));
			return {
				items: preferenceKinds.map((kind) => ({
					kind,
					inApp: rows.find((row) => row.kind === kind)?.inApp ?? true,
					email:
						notificationEmailDeliveryEnabled &&
						(rows.find((row) => row.kind === kind)?.email ?? true),
				})),
			};
		},
	)
	.put(
		"/preferences",
		{
			access: "write:notification:write",
			body: ReplaceNotificationPreferencesBody,
			response: { [StatusCodes.OK]: NotificationPreferencesResponse },
			detail: { summary: "Update notification preferences", tags: ["Notifications"] },
		},
		async ({ profile, body }) => {
			await database.transaction(async (tx) => {
				for (const item of body.items)
					await tx
						.insert(notificationPreference)
						.values({
							profileId: profile.unitId,
							...item,
							email: notificationEmailDeliveryEnabled && item.email,
						})
						.onConflictDoUpdate({
							target: [notificationPreference.profileId, notificationPreference.kind],
							set: {
								inApp: item.inApp,
								email: notificationEmailDeliveryEnabled && item.email,
							},
						});
			});
			const rows = new Map<string, (typeof body.items)[number]>(
				body.items.map((item) => [
					item.kind,
					{
						...item,
						email: notificationEmailDeliveryEnabled && item.email,
					},
				]),
			);
			return {
				items: preferenceKinds.map((kind) => rows.get(kind) ?? { kind, inApp: true, email: false }),
			};
		},
	);

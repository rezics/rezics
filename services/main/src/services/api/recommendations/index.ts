import { StatusCodes } from "http-status-codes";
import { and, eq, inArray } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { getUnitReadCondition } from "../../authorization/unit/query";
import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import {
	profilePreference,
	recommendationEvent,
	recommendationExclusion,
	post,
	unit,
} from "../../database/schema";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { parseJsonCursor } from "../../pagination";
import {
	resolveRecommendationSnapshot,
	resolveRecommendationViewer,
} from "../../recommendations/context";
import { recommendUnits } from "../../recommendations/catalog";
import { RecommendationPolicyVersion } from "../../recommendations/policy";
import { recommendRelatedPosts } from "../../recommendations/related-posts";
import { verifyRecommendationTracking } from "../../recommendations/tracking";
import { UnitNotFound } from "../../units/errors";
import { ValidationError } from "../errors";
import { FeedResponse, toApiErrorResponse } from "../schema/response";
import {
	RelatedPostParams,
	RelatedPostQuery,
	RecommendationEventBatchBody,
	RecommendationEventBatchResponse,
	RecommendationExclusionBody,
	RecommendationExclusionParams,
	RecommendationExclusionResponse,
	RecommendationPolicyVersionSchema,
	UnitRecommendationQuery,
	UnitRecommendationResponse,
} from "./schema";

const UnitRecommendationCursor = t.Object(
	{
		v: t.Literal(1),
		type: t.Nullable(t.Union([t.Literal("book"), t.Literal("game"), t.Literal("media")])),
		seedUnitId: t.Nullable(t.String({ format: "uuid" })),
		personalized: t.Boolean(),
		snapshotId: t.Nullable(t.String({ format: "uuid" })),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		lastId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);
type UnitRecommendationCursor = typeof UnitRecommendationCursor.static;

const RelatedPostCursor = t.Object(
	{
		v: t.Literal(1),
		postId: t.String({ format: "uuid" }),
		personalized: t.Boolean(),
		snapshotId: t.Nullable(t.String({ format: "uuid" })),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		lastId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);
type RelatedPostCursor = typeof RelatedPostCursor.static;

function decodeUnitCursor(value?: string) {
	if (!value) return undefined;
	try {
		return parseJsonCursor(value, UnitRecommendationCursor);
	} catch {
		throw new InvalidPaginationCursor();
	}
}

function decodePostCursor(value?: string) {
	if (!value) return undefined;
	try {
		return parseJsonCursor(value, RelatedPostCursor);
	} catch {
		throw new InvalidPaginationCursor();
	}
}

async function resolvePageSnapshot(cursor?: { snapshotId: string | null }) {
	if (!cursor) return resolveRecommendationSnapshot();
	if (!cursor.snapshotId) return null;
	const snapshot = await resolveRecommendationSnapshot(cursor.snapshotId);
	if (!snapshot) throw new InvalidPaginationCursor();
	return snapshot;
}

function encodeCursor(value: UnitRecommendationCursor | RelatedPostCursor) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function ensureEventTime(value: Date, now: Date) {
	const minimum = now.getTime() - 86_400_000;
	const maximum = now.getTime() + 5 * 60_000;
	if (value.getTime() < minimum || value.getTime() > maximum)
		throw new ValidationError({
			occurredAt: "must be within the last 24 hours and no more than 5 minutes ahead",
		});
}

function ensureRecommendationTracking(
	targetUnitId: string,
	tracking: Parameters<typeof verifyRecommendationTracking>[1],
) {
	if (!verifyRecommendationTracking(targetUnitId, tracking))
		throw new ValidationError({ tracking: "invalid recommendation tracking signature" });
}

const RecommendationWriteUnauthorizedResponse = toApiErrorResponse(["AuthenticationRequired"]);
const RecommendationWriteForbiddenResponse = toApiErrorResponse([
	"ApiTokenScopeRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
]);

async function getEventProfileId(headers: Headers) {
	const identity = await resolveIdentity(headers);
	const profileId = identity.profile?.unitId;
	if (!profileId) return { identity, profileId: undefined };
	const [preference] = await database
		.select({ personalized: profilePreference.personalizedFeed })
		.from(profilePreference)
		.where(eq(profilePreference.profileId, profileId))
		.limit(1);
	return { identity, profileId: (preference?.personalized ?? true) ? profileId : undefined };
}

export default new Elysia({ prefix: "/recommendations" })
	.use(session)
	.get(
		"/units",
		async ({ query, request }) => {
			const identity = await resolveIdentity(request.headers);
			const viewer = await resolveRecommendationViewer(
				identity.profile?.unitId,
				query.personalized,
			);
			const cursor = decodeUnitCursor(query.cursor);
			if (
				cursor &&
				(cursor.type !== (query.type ?? null) ||
					cursor.seedUnitId !== (query.seedUnitId ?? null) ||
					cursor.personalized !== viewer.personalized ||
					cursor.limit !== (query.limit ?? 20) ||
					Number.isNaN(Date.parse(cursor.asOf)))
			)
				throw new InvalidPaginationCursor();
			if (query.seedUnitId) {
				const [seed] = await database
					.select({ id: unit.id })
					.from(unit)
					.where(
						and(
							eq(unit.id, query.seedUnitId),
							getUnitReadCondition(identity.profile?.unitId),
							eq(unit.moderationStatus, "approved"),
						),
					)
					.limit(1);
				if (!seed) throw new UnitNotFound();
			}
			const snapshot = await resolvePageSnapshot(cursor);
			const policyVersion = snapshot?.policyVersion ?? RecommendationPolicyVersion;
			if (cursor?.policyVersion !== undefined && cursor.policyVersion !== policyVersion)
				throw new InvalidPaginationCursor();
			const asOf = cursor ? new Date(cursor.asOf) : new Date();
			const result = await recommendUnits({
				viewer,
				snapshot,
				...(query.type ? { type: query.type } : {}),
				...(query.seedUnitId ? { seedUnitId: query.seedUnitId } : {}),
				asOf,
				pageSize: query.limit ?? 20,
				...(cursor ? { afterId: cursor.lastId } : {}),
				requestId: crypto.randomUUID(),
			});
			if (!result) throw new InvalidPaginationCursor();
			return {
				items: result.items,
				nextCursor: result.nextId
					? encodeCursor({
							v: 1,
							type: query.type ?? null,
							seedUnitId: query.seedUnitId ?? null,
							personalized: viewer.personalized,
							snapshotId: snapshot?.id ?? null,
							policyVersion,
							limit: query.limit ?? 20,
							asOf: asOf.toISOString(),
							lastId: result.nextId,
						})
					: null,
			};
		},
		{
			query: UnitRecommendationQuery,
			response: {
				[StatusCodes.OK]: UnitRecommendationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Recommend catalog units", tags: ["Recommendations"] },
		},
	)
	.get(
		"/posts/:postId",
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request.headers);
			const viewer = await resolveRecommendationViewer(
				identity.profile?.unitId,
				query.personalized,
			);
			const cursor = decodePostCursor(query.cursor);
			if (
				cursor &&
				(cursor.postId !== params.postId ||
					cursor.personalized !== viewer.personalized ||
					cursor.limit !== (query.limit ?? 20) ||
					Number.isNaN(Date.parse(cursor.asOf)))
			)
				throw new InvalidPaginationCursor();
			const [seed] = await database
				.select({
					id: post.id,
					subjectId: post.subjectUnitId,
					authorId: post.authorProfileId,
				})
				.from(post)
				.innerJoin(unit, eq(unit.id, post.id))
				.where(
					and(
						eq(post.id, params.postId),
						getUnitReadCondition(identity.profile?.unitId),
						eq(unit.moderationStatus, "approved"),
					),
				)
				.limit(1);
			if (!seed) throw new UnitNotFound();
			const snapshot = await resolvePageSnapshot(cursor);
			const policyVersion = snapshot?.policyVersion ?? RecommendationPolicyVersion;
			if (cursor?.policyVersion !== undefined && cursor.policyVersion !== policyVersion)
				throw new InvalidPaginationCursor();
			const asOf = cursor ? new Date(cursor.asOf) : new Date();
			const result = await recommendRelatedPosts({
				viewer,
				snapshot,
				seed,
				asOf,
				pageSize: query.limit ?? 20,
				...(cursor ? { afterId: cursor.lastId } : {}),
				requestId: crypto.randomUUID(),
			});
			if (!result) throw new InvalidPaginationCursor();
			return {
				items: result.items,
				nextCursor: result.nextId
					? encodeCursor({
							v: 1,
							postId: params.postId,
							personalized: viewer.personalized,
							snapshotId: snapshot?.id ?? null,
							policyVersion,
							limit: query.limit ?? 20,
							asOf: asOf.toISOString(),
							lastId: result.nextId,
						})
					: null,
			};
		},
		{
			params: RelatedPostParams,
			query: RelatedPostQuery,
			response: {
				[StatusCodes.OK]: FeedResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Recommend related posts", tags: ["Recommendations"] },
		},
	)
	.post(
		"/events",
		async ({ body, request }) => {
			const now = new Date();
			for (const event of body.events) {
				ensureEventTime(event.occurredAt, now);
				ensureRecommendationTracking(event.targetUnitId, event);
			}
			const { identity, profileId } = await getEventProfileId(request.headers);
			const targetIds = [...new Set(body.events.map(({ targetUnitId }) => targetUnitId))];
			const readable = await database
				.select({ id: unit.id })
				.from(unit)
				.where(
					and(
						inArray(unit.id, targetIds),
						getUnitReadCondition(identity.profile?.unitId),
						eq(unit.moderationStatus, "approved"),
					),
				);
			if (readable.length !== targetIds.length) throw new UnitNotFound();
			const inserted = await database
				.insert(recommendationEvent)
				.values(
					body.events.map((event) => ({
						id: event.id,
						profileId,
						requestId: event.requestId,
						surface: event.surface,
						type: event.type,
						targetUnitId: event.targetUnitId,
						position: event.position,
						policyVersion: event.policyVersion,
						occurredAt: event.occurredAt,
					})),
				)
				.onConflictDoNothing()
				.returning({ id: recommendationEvent.id });
			return { accepted: inserted.length };
		},
		{
			body: RecommendationEventBatchBody,
			response: {
				[StatusCodes.OK]: RecommendationEventBatchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Record recommendation events", tags: ["Recommendations"] },
		},
	)
	.put(
		"/exclusions/:unitId",
		async ({ body, params, profile, authorization }) => {
			ensureEventTime(body.occurredAt, new Date());
			ensureRecommendationTracking(params.unitId, body);
			await authorization.unit.ensureCanRead(params.unitId);
			await database.transaction(async (tx) => {
				await tx
					.insert(recommendationExclusion)
					.values({ profileId: profile.unitId, unitId: params.unitId })
					.onConflictDoNothing();
				await tx
					.insert(recommendationEvent)
					.values({
						id: body.eventId,
						profileId: profile.unitId,
						requestId: body.requestId,
						surface: body.surface,
						type: "not_interested",
						targetUnitId: params.unitId,
						position: body.position,
						policyVersion: body.policyVersion,
						occurredAt: body.occurredAt,
					})
					.onConflictDoNothing();
			});
			return { excluded: true };
		},
		{
			write: true,
			params: RecommendationExclusionParams,
			body: RecommendationExclusionBody,
			response: {
				[StatusCodes.OK]: RecommendationExclusionResponse,
				[StatusCodes.UNAUTHORIZED]: RecommendationWriteUnauthorizedResponse,
				[StatusCodes.FORBIDDEN]: RecommendationWriteForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Exclude a recommendation", tags: ["Recommendations"] },
		},
	)
	.delete(
		"/exclusions/:unitId",
		async ({ params, profile }) => {
			await database
				.delete(recommendationExclusion)
				.where(
					and(
						eq(recommendationExclusion.profileId, profile.unitId),
						eq(recommendationExclusion.unitId, params.unitId),
					),
				);
			return { excluded: false };
		},
		{
			write: true,
			params: RecommendationExclusionParams,
			response: {
				[StatusCodes.OK]: RecommendationExclusionResponse,
				[StatusCodes.UNAUTHORIZED]: RecommendationWriteUnauthorizedResponse,
				[StatusCodes.FORBIDDEN]: RecommendationWriteForbiddenResponse,
			},
			detail: { summary: "Restore an excluded recommendation", tags: ["Recommendations"] },
		},
	);

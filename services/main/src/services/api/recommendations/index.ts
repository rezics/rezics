import { saveRecommendationExclusion, removeRecommendationExclusion } from "../../recommendations/exclusions";
import { CatalogOwnerValues } from "@rezics/reference";
import { unitStatesForIds } from "../../units/state-relation";
import { and, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";
import type { StaticDecode } from "typebox";

import session, { resolveIdentity } from "../../auth/session";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { database, withDatabaseTransactionDeadline } from "../../database";
import { recordRecommendationEvents } from "../../recommendations/events";
import {
	ContentRatingValues,
	post,
} from "../../database/schema";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import {
	resolveRecommendationSnapshot,
	resolveRecommendationViewer,
} from "../../recommendations/context";
import { RecommendationPolicy, RecommendationPolicyVersion } from "../../recommendations/policy";
import { recommendRelatedPosts } from "../../recommendations/related-posts";
import { verifyRecommendationTracking } from "../../recommendations/tracking";
import { recommendUnits } from "../../recommendations/units";
import { getAttributionSummariesByUnitIds } from "../../units/attribution";
import { UnitNotFound } from "../../units/errors";
import { ValidationError } from "../errors";
import { PostFeedResponse, toApiErrorResponse } from "../schema/response";
import {
	RecommendationEventBatchBody,
	RecommendationEventBatchResponse,
	RecommendationExclusionBody,
	RecommendationExclusionParams,
	RecommendationExclusionResponse,
	RecommendationPolicyVersionSchema,
	RelatedPostParams,
	RelatedPostQuery,
	UnitRecommendationQuery,
	UnitRecommendationResponse,
} from "./schema";

const UnitRecommendationCursor = t.Object(
	{
		v: t.Literal(1),
		owner: t.Nullable(t.UnionEnum(CatalogOwnerValues)),
		shape: t.Nullable(t.String()),
		seedUnitId: t.Nullable(t.String({ format: "uuid" })),
		contentRatings: t.Array(t.UnionEnum(ContentRatingValues), { uniqueItems: true }),
		personalized: t.Boolean(),
		snapshotId: t.Nullable(t.String({ format: "uuid" })),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		lastId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);
type UnitRecommendationCursor = StaticDecode<typeof UnitRecommendationCursor>;

const RelatedPostCursor = t.Object(
	{
		v: t.Literal(1),
		postId: t.String({ format: "uuid" }),
		contentRatings: t.Array(t.UnionEnum(ContentRatingValues), { uniqueItems: true }),
		personalized: t.Boolean(),
		snapshotId: t.Nullable(t.String({ format: "uuid" })),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		lastId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);
type RelatedPostCursor = StaticDecode<typeof RelatedPostCursor>;

function equalOrderedValues(
	left: readonly (number | string)[],
	right: readonly (number | string)[],
) {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

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
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"AccountSuspended",
	"AccountClosed",
	"ParticipationDenied",
]);


export default new Elysia({ prefix: "/recommendations" })
	.use(session)
	.get(
		"/units",
		{
			query: UnitRecommendationQuery,
			response: {
				[StatusCodes.OK]: UnitRecommendationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Recommend Units", tags: ["Recommendations"] },
		},
		async ({ query, request }) => {
			const identity = await resolveIdentity(request, "recommendation:read");
			const viewer = await resolveRecommendationViewer(identity.entity?.id, query.personalized);
			const cursor = decodeUnitCursor(query.cursor);
			if (
				cursor &&
				(cursor.owner !== (query.owner ?? null) || cursor.shape !== (query.shape ?? null) ||
					cursor.seedUnitId !== (query.seedUnitId ?? null) ||
					!equalOrderedValues(cursor.contentRatings, viewer.contentRatings) ||
					cursor.personalized !== viewer.personalized ||
					cursor.limit !== (query.limit ?? 20) ||
					Number.isNaN(Date.parse(cursor.asOf)))
			)
				throw new InvalidPaginationCursor();
            if (query.seedUnitId) {
                const state=unitStatesForIds([query.seedUnitId],"recommendation_seed");
                const [seed]=await database.select({id:state.id}).from(state)
                 .where(and(getUnitReadCondition(identity.entity?.id,{},state),eq(state.moderationStatus,"approved"))).limit(1);
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
				...(query.owner ? { owner: query.owner } : {}),
                ...(query.shape ? {shape:query.shape} : {}),
				...(query.seedUnitId ? { seedUnitId: query.seedUnitId } : {}),
				asOf,
				pageSize: query.limit ?? 20,
				localizationLanguages: query.localizationLanguages ?? [],
				...(cursor ? { afterId: cursor.lastId } : {}),
				requestId: crypto.randomUUID(),
			});
			if (!result) throw new InvalidPaginationCursor();
			return {
				items: result.items,
				nextCursor: result.nextId
					? encodeCursor({
							v: 1,
							owner: query.owner ?? null,
                            shape:query.shape ?? null,
							seedUnitId: query.seedUnitId ?? null,
							contentRatings: [...viewer.contentRatings],
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
	)
	.get(
		"/posts/:postId",
		{
			params: RelatedPostParams,
			query: RelatedPostQuery,
			response: {
				[StatusCodes.OK]: PostFeedResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Recommend related posts", tags: ["Recommendations"] },
		},
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request, "recommendation:read");
			const viewer = await resolveRecommendationViewer(identity.entity?.id, query.personalized);
			const cursor = decodePostCursor(query.cursor);
			if (
				cursor &&
				(cursor.postId !== params.postId ||
					!equalOrderedValues(cursor.contentRatings, viewer.contentRatings) ||
					cursor.personalized !== viewer.personalized ||
					cursor.limit !== (query.limit ?? 20) ||
					Number.isNaN(Date.parse(cursor.asOf)))
			)
				throw new InvalidPaginationCursor();
			const [seedBase] = await database
				.select({
					id: post.id,
					subjectId: post.subjectUnitId,
				})
				.from(post)
				.where(
					and(
						eq(post.id, params.postId),
						getUnitReadCondition(identity.entity?.id, {}, post),
						eq(post.moderationStatus, "approved"),
					),
				)
				.limit(1);
			if (!seedBase) throw new UnitNotFound();
			const attributionMap = await getAttributionSummariesByUnitIds([seedBase.id], [], {maximumPerSourceUnit:32});
			const seed = {
				...seedBase,
				creditedEntityIds: (attributionMap.get(seedBase.id) ?? []).map(
					({ creditedEntity }) => creditedEntity.id,
				),
			};
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
				localizationLanguages: query.localizationLanguages ?? [],
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
							contentRatings: [...viewer.contentRatings],
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
	)
	.post(
		"/events",
		{
			body: RecommendationEventBatchBody,
			response: {
				[StatusCodes.OK]: RecommendationEventBatchResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["ApiTokenPermissionRequired", "AccountSuspended", "AccountClosed", "ParticipationDenied"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Record recommendation events", tags: ["Recommendations"] },
		},
		async ({ body, request }) => {
			const identity = await resolveIdentity(request, "recommendation:read");
			return withDatabaseTransactionDeadline(RecommendationPolicy.eventTransactionMs, () =>
				database.transaction(tx => recordRecommendationEvents(tx, identity.authorization, body.events)));
		},
	)

	.put(
		"/exclusions/:unitId",
		{
			access: "write:recommendation:write",
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
		async ({ body, params, authorization }) => {
			ensureEventTime(body.occurredAt, new Date());
			ensureRecommendationTracking(params.unitId, body);
			return database.transaction((tx) =>
				saveRecommendationExclusion(tx, authorization, params.unitId, body),
			);
		},
	)
	.delete(
		"/exclusions/:unitId",
		{
			access: "write:recommendation:write",
			params: RecommendationExclusionParams,
			response: {
				[StatusCodes.OK]: RecommendationExclusionResponse,
				[StatusCodes.UNAUTHORIZED]: RecommendationWriteUnauthorizedResponse,
				[StatusCodes.FORBIDDEN]: RecommendationWriteForbiddenResponse,
			},
			detail: { summary: "Restore an excluded recommendation", tags: ["Recommendations"] },
		},
		({ params, authorization }) =>
			database.transaction((tx) => removeRecommendationExclusion(tx, authorization, params.unitId)),
	);

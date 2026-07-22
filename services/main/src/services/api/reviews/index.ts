import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import { isPrimaryUnitLocalization, makePrimaryUnitLocalization } from "../../units/localization";
import {
	post,
	globalScoreContext,
	realmUnit,
	scoreStat,
	unit,
	unitAccessBinding,
	unitLocalization,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import {
	ensurePostMountTargetingAllowed,
	ensureSubjectPostTargetingAllowed,
} from "../../posts/targeting";
import {
	createProfilePublisherAttribution,
	getAttributionSummariesByUnitIds,
} from "../../units/attribution";
import {
	IdResponse,
	NoContentResponse,
	ScoreAggregateResponse,
	ScoreContextResponse,
	ScoreResponse,
} from "../schema/action-response";
import {
	toApiErrorResponse,
	toPortableTextResponse,
	ReviewDetailResponse,
	ReviewListResponse,
} from "../schema/response";
import {
	CreateReviewBody,
	GetReviewQuery,
	ListReviewsQuery,
	ReviewParams,
	ScoreAggregateQuery,
	ScoreTargetParams,
	SetScoreBody,
	SetScoreContextBody,
	UpdateReviewBody,
} from "./schema";
import { upsertScore } from "./service";
import { ReviewNotFound } from "./errors";
import { PostNotFound } from "../posts/errors";

const UnitReadFailureResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);

export default new Elysia()
	.use(session)
	.group("/reviews", (app) =>
		app
			.get(
				"",
				async ({ query }) => {
					const items = await database
						.select({
							id: post.id,
							targetId: post.subjectUnitId,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.where(
							and(
								eq(post.kind, "review"),
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
								isNull(unit.deletedAt),
								query.targetId ? eq(post.subjectUnitId, query.targetId) : undefined,
								query.realmId
									? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${query.realmId} and rc.status = 'visible')`
									: undefined,
							),
						)
						.orderBy(desc(unit.createdAt), desc(unit.id))
						.limit(query.limit ?? 20);
					const attributions = await getAttributionSummariesByUnitIds(
						items.map(({ id }) => id),
					);
					return {
						items: items.flatMap((item) =>
							item.targetId
								? [
										{
											...item,
											realmId: query.realmId ?? null,
											targetId: item.targetId,
											attributions: attributions.get(item.id) ?? [],
										},
									]
								: [],
						),
					};
				},
				{
					query: ListReviewsQuery,
					response: { [StatusCodes.OK]: ReviewListResponse },
					detail: { summary: "List reviews", tags: ["Reviews"] },
				},
			)
			.post(
				"",
				async ({ profile, authorization, body }) => {
					await authorization.unit.ensureCanRead(body.targetId);
					await authorization.realm.ensureParticipation(body.realmId);
					const id = await database.transaction(async (tx) => {
						await authorization.entity.ensureSubjectAssociationAllowedIfEntity(
							tx,
							body.targetId,
						);
						const created = await insertUnit(tx, {
							kind: "post",
							status: "published",
							visibility: "public",
							publishedAt: new Date(),
							statusActor: { kind: "profile", profileId: profile.unitId },
						});
						await ensureSubjectPostTargetingAllowed(tx, {
							sourcePostId: created.id,
							subjectUnitId: body.targetId,
							...(body.realmId ? { realmId: body.realmId } : {}),
						});
						await tx.insert(post).values({
							id: created.id,
							subjectUnitId: body.targetId,
							kind: "review",
						});
						await tx.insert(unitLocalization).values({
							unitId: created.id,
							language: body.language,
							title: body.title,
							summary: body.summary,
							content: body.body,
							contentStatus: "published",
						});
						await tx.insert(unitAccessBinding).values({
							unitId: created.id,
							subjectKind: "profile",
							profileId: profile.unitId,
							role: "owner",
							scope: [],
							grantedByProfileId: profile.unitId,
						});
						await createProfilePublisherAttribution(tx, {
							sourceUnitId: created.id,
							profileId: profile.unitId,
						});
						if (body.realmId) {
							await ensurePostMountTargetingAllowed(tx, {
								postId: created.id,
								realmId: body.realmId,
							});
							await tx
								.insert(realmUnit)
								.values({ realmId: body.realmId, unitId: created.id });
						}
						await recordUnitRevision(tx, {
							unitId: created.id,
							actorProfileId: profile.unitId,
							event: "create",
						});
						return created.id;
					});
					return { id };
				},
				{
					access: "contribute:unit:create",
					body: CreateReviewBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"EntityAssociationRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"EntityEntryNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
							"PostTargetingLocked",
						]),
					},
					detail: { summary: "Create review", tags: ["Reviews"] },
				},
			)
			.get(
				"/:reviewId",
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.reviewId,
						() => new UnitNotFound("Review"),
					);
					const [review] = await database
						.select({
							id: post.id,
							targetId: post.subjectUnitId,
							language: unitLocalization.language,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
							body: unitLocalization.content,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.where(
							and(
								eq(post.id, params.reviewId),
								eq(post.kind, "review"),
								query.realmId
									? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${query.realmId} and rc.status = 'visible')`
									: undefined,
							),
						)
						.limit(1);
					if (!review?.targetId) throw new ReviewNotFound();
					const attributions =
						(await getAttributionSummariesByUnitIds([review.id])).get(review.id) ?? [];
					return {
						...review,
						realmId: query.realmId ?? null,
						attributions,
						targetId: review.targetId,
						body: review.body === null ? null : toPortableTextResponse(review.body),
						capabilities: {
							canEdit: await authorization.unit.canUpdate(params.reviewId),
						},
					};
				},
				{
					params: ReviewParams,
					query: GetReviewQuery,
					response: {
						[StatusCodes.OK]: ReviewDetailResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ReviewNotFound",
						]),
					},
					detail: { summary: "Get review", tags: ["Reviews"] },
				},
			)
			.patch(
				"/:reviewId",
				async ({ params, profile, authorization, body }) => {
					await authorization.unit.ensureCanUpdate(params.reviewId, [["localizations"]]);
					await database.transaction(async (tx) => {
						await tx
							.insert(unitLocalization)
							.values({
								unitId: params.reviewId,
								language: body.language,
								title: body.title,
								summary: body.summary,
								content: body.body,
								contentStatus: "published",
							})
							.onConflictDoUpdate({
								target: [unitLocalization.unitId, unitLocalization.language],
								set: {
									title: body.title,
									summary: body.summary,
									content: body.body,
									contentStatus: "published",
								},
							});
						await makePrimaryUnitLocalization(tx, params.reviewId, body.language);
						await recordUnitRevision(tx, {
							unitId: params.reviewId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return { id: params.reviewId };
				},
				{
					access: "contribute:unit:update",
					params: ReviewParams,
					body: UpdateReviewBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
					},
					detail: { summary: "Update review", tags: ["Reviews"] },
				},
			)
			.delete(
				"/:reviewId",
				async ({ params, profile, authorization }) => {
					await authorization.unit.ensure(params.reviewId, "unit.delete");
					await database.transaction(async (tx) => {
						await tx
							.update(unit)
							.set({ deletedAt: new Date() })
							.where(and(eq(unit.id, params.reviewId), eq(unit.kind, "post")));
						await recordUnitRevision(tx, {
							unitId: params.reviewId,
							actorProfileId: profile.unitId,
							event: "delete",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:delete",
					params: ReviewParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
						[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
					},
					detail: {
						summary: "Delete review",
						tags: ["Reviews"],
						responses: NoContentResponse,
					},
				},
			),
	)
	.group("/scores", (app) =>
		app
			.put(
				"/:targetId",
				async ({ params, profile, authorization, body }) => {
					await authorization.unit.ensureCanRead(params.targetId);
					await authorization.realm.ensureParticipation(body.realmId);
					const scoreId = await database.transaction((tx) =>
						upsertScore(tx, profile.unitId, params.targetId, body.realmId, body.score),
					);
					return { scoreId, score: body.score };
				},
				{
					access: "contribute:interaction:write",
					params: ScoreTargetParams,
					body: SetScoreBody,
					response: {
						[StatusCodes.OK]: ScoreResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
						]),
					},
					detail: { summary: "Score unit", tags: ["Reviews"] },
				},
			)
			.get(
				"/:targetId",
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(params.targetId);
					await authorization.unit.ensureCanRead(query.realmId);
					const [stat] = await database
						.select()
						.from(scoreStat)
						.where(
							and(
								eq(scoreStat.unitId, params.targetId),
								eq(scoreStat.realmId, query.realmId),
							),
						)
						.limit(1);
					const distribution = [
						stat?.score1Count ?? 0n,
						stat?.score2Count ?? 0n,
						stat?.score3Count ?? 0n,
						stat?.score4Count ?? 0n,
						stat?.score5Count ?? 0n,
						stat?.score6Count ?? 0n,
						stat?.score7Count ?? 0n,
						stat?.score8Count ?? 0n,
						stat?.score9Count ?? 0n,
						stat?.score10Count ?? 0n,
					].flatMap((value, index) => {
						const count = toSafeInteger(value, `score ${index + 1} count`);
						return count === 0 ? [] : ([[index + 1, count]] as const);
					});
					return {
						totalScore: toSafeInteger(stat?.totalScore ?? 0n, "total score"),
						totalCount: toSafeInteger(stat?.totalCount ?? 0n, "score count"),
						distribution: Object.fromEntries(distribution),
					};
				},
				{
					params: ScoreTargetParams,
					query: ScoreAggregateQuery,
					response: {
						[StatusCodes.OK]: ScoreAggregateResponse,
						[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
					},
					detail: { summary: "Get score aggregate", tags: ["Reviews"] },
				},
			),
	)
	.group("/score-context", (app) =>
		app
			.get(
				"",
				async ({ request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					const [context] = await database
						.select({ contextPostId: globalScoreContext.contextPostId })
						.from(globalScoreContext)
						.where(eq(globalScoreContext.singleton, true))
						.limit(1);
					if (context)
						await authorization.unit.ensureCanRead(
							context.contextPostId,
							() => new PostNotFound(),
						);
					return { contextPostId: context?.contextPostId ?? null };
				},
				{
					response: {
						[StatusCodes.OK]: ScoreContextResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PostNotFound"]),
					},
					detail: { summary: "Get global Score context", tags: ["Scores"] },
				},
			)
			.put(
				"",
				async ({ profile, authorization, body }) => {
					await authorization.platform.ensureCapability("platform.score-context.manage");
					await authorization.unit.ensureCanRead(
						body.contextPostId,
						() => new PostNotFound(),
					);
					const [record] = await database
						.select({ id: post.id })
						.from(post)
						.where(eq(post.id, body.contextPostId))
						.limit(1);
					if (!record) throw new PostNotFound();
					await database
						.insert(globalScoreContext)
						.values({
							singleton: true,
							contextPostId: body.contextPostId,
							createdByProfileId: profile.unitId,
						})
						.onConflictDoUpdate({
							target: globalScoreContext.singleton,
							set: { contextPostId: body.contextPostId, updatedAt: new Date() },
						});
					return { contextPostId: body.contextPostId };
				},
				{
					access: "session-only",
					body: SetScoreContextBody,
					response: {
						[StatusCodes.OK]: ScoreContextResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PostNotFound"]),
					},
					detail: { summary: "Set global Score context", tags: ["Scores"] },
				},
			)
			.delete(
				"",
				async ({ authorization }) => {
					await authorization.platform.ensureCapability("platform.score-context.manage");
					await database
						.delete(globalScoreContext)
						.where(eq(globalScoreContext.singleton, true));
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "session-only",
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
					},
					detail: {
						summary: "Clear global Score context",
						tags: ["Scores"],
						responses: NoContentResponse,
					},
				},
			),
	);

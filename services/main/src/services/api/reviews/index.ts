import { StatusCodes } from "http-status-codes";
import { and, count, desc, eq, isNull, sql, sum } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { defaultUnitTitle } from "../../database/localization";
import {
	post,
	profile as profileTable,
	realmUnit,
	score,
	unit,
	unitCollaborator,
	unitLocalization,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import {
	IdResponse,
	NoContentResponse,
	ScoreAggregateResponse,
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
	ListReviewsQuery,
	ReviewParams,
	ScoreAggregateQuery,
	ScoreTargetParams,
	SetScoreBody,
	UpdateReviewBody,
} from "./schema";
import { upsertScore } from "./service";
import { ReviewNotFound, ReviewRealmRequired } from "./errors";

const UnitReadFailureResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitEditForbidden", "UnitFieldLocked"]);

const primaryRealmId = sql<string | null>`(
	select rc.realm_id from realm_unit rc
	where rc.unit_id = ${post.id}
		and rc.status = 'visible'
	order by rc.created_at, rc.realm_id limit 1
)`;

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
							authorId: post.authorProfileId,
							authorName: defaultUnitTitle(profileTable.id),
							targetId: post.subjectUnitId,
							realmId: primaryRealmId,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.innerJoin(profileTable, eq(profileTable.id, post.authorProfileId))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								eq(unitLocalization.isDefault, true),
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
					return {
						items: items.flatMap((item) =>
							item.targetId ? [{ ...item, targetId: item.targetId }] : [],
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
					let scoreInput: { realmId: string; score: number } | undefined;
					if (body.score !== undefined) {
						if (!body.realmId) throw new ReviewRealmRequired();
						scoreInput = { realmId: body.realmId, score: body.score };
					}
					const id = await database.transaction(async (tx) => {
						if (scoreInput) {
							await upsertScore(
								tx,
								profile.unitId,
								body.targetId,
								scoreInput.realmId,
								scoreInput.score,
							);
						}
						const [created] = await tx
							.insert(unit)
							.values({
								kind: "post",
								status: "published",
								visibility: "public",
								publishedAt: new Date(),
							})
							.returning({ id: unit.id });
						if (!created) throw new Error("Review insertion did not return an id");
						await tx.insert(post).values({
							id: created.id,
							authorProfileId: profile.unitId,
							subjectUnitId: body.targetId,
							kind: "review",
						});
						await tx.insert(unitLocalization).values({
							unitId: created.id,
							language: body.language,
							isDefault: true,
							title: body.title,
							summary: body.summary,
							content: body.body,
							contentStatus: "published",
						});
						await tx.insert(unitCollaborator).values({
							unitId: created.id,
							profileId: profile.unitId,
							role: "owner",
							addedByProfileId: profile.unitId,
						});
						if (body.realmId)
							await tx
								.insert(realmUnit)
								.values({ realmId: body.realmId, unitId: created.id });
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
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ReviewRealmRequired"]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
						]),
					},
					detail: { summary: "Create review", tags: ["Reviews"] },
				},
			)
			.get(
				"/:reviewId",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.reviewId,
						() => new UnitNotFound("Review"),
					);
					const [review] = await database
						.select({
							id: post.id,
							authorId: post.authorProfileId,
							targetId: post.subjectUnitId,
							realmId: primaryRealmId,
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
								eq(unitLocalization.isDefault, true),
							),
						)
						.where(and(eq(post.id, params.reviewId), eq(post.kind, "review")))
						.limit(1);
					if (!review?.targetId) throw new ReviewNotFound();
					return {
						...review,
						targetId: review.targetId,
						body: review.body === null ? null : toPortableTextResponse(review.body),
						capabilities: {
							canEdit: await authorization.unit.canEdit(params.reviewId),
						},
					};
				},
				{
					params: ReviewParams,
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
					await authorization.unit.ensureCanEdit(params.reviewId);
					await authorization.unit.ensureFieldsUnlocked(params.reviewId, [
						"/localizations",
					]);
					await database.transaction(async (tx) => {
						await tx
							.update(unitLocalization)
							.set({ isDefault: false })
							.where(eq(unitLocalization.unitId, params.reviewId));
						await tx
							.insert(unitLocalization)
							.values({
								unitId: params.reviewId,
								language: body.language,
								isDefault: true,
								title: body.title,
								summary: body.summary,
								content: body.body,
								contentStatus: "published",
							})
							.onConflictDoUpdate({
								target: [unitLocalization.unitId, unitLocalization.language],
								set: {
									isDefault: true,
									title: body.title,
									summary: body.summary,
									content: body.body,
									contentStatus: "published",
								},
							});
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
					await authorization.unit.ensureCanEdit(params.reviewId);
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
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitEditForbidden"]),
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
					const scoreEntryId = await database.transaction((tx) =>
						upsertScore(tx, profile.unitId, params.targetId, body.realmId, body.score),
					);
					return { scoreEntryId, score: body.score };
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
					const condition = and(
						eq(score.unitId, params.targetId),
						eq(score.realmId, query.realmId),
					);
					const [[totals], rows] = await Promise.all([
						database
							.select({ totalScore: sum(score.value), totalCount: count() })
							.from(score)
							.where(condition),
						database
							.select({ value: score.value, total: count() })
							.from(score)
							.where(condition)
							.groupBy(score.value),
					]);
					return {
						totalScore: Number(totals?.totalScore ?? 0),
						totalCount: totals?.totalCount ?? 0,
						distribution: Object.fromEntries(rows.map((row) => [row.value, row.total])),
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
	);

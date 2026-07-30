import { StatusCodes } from "http-status-codes";
import { and, asc, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	isFirstUnitLocalization,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";
import {
	post,
	postProgressEntry,
	postReplyStat,
	postScore,
	recommendationUnitStat,
	score,
	scoreStat,
	unit,
	unitOwnership,
	unitLocalization,
	unitProgressEntry,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { fractionalPositionAt } from "../../ordering/position";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { ensureSubjectPostTargetingAllowed, findPostTargetingLock } from "../../posts/targeting";
import { publishPostToRealms } from "../../posts/publication";
import { getPostSubjectPresentation } from "../../posts/presentation";
import { selectPostScores } from "../../posts/scores";
import { selectPostProgressEntry } from "../../posts/progress";
import {
	createProfilePublisherAttribution,
	getAttributionSummariesByUnitIds,
} from "../../units/attribution";
import {
	fallbackRecommendationSnapshot,
	resolveRecommendationSnapshot,
	resolveRecommendationViewer,
} from "../../recommendations/context";
import { recommendationObjectiveExpression } from "../../recommendations/sql-ranking";
import {
	IdResponse,
	ScoreAggregateResponse,
	ScoreResponse,
	ViewerScoreListResponse,
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
	ListViewerScoresQuery,
	ReviewSortSchema,
	ReviewParams,
	resolveReviewScoreFilter,
	ScoreAggregateQuery,
	ScoreTargetParams,
	SetScoreBody,
	UpdateReviewBody,
} from "./schema";
import { upsertScore } from "./service";
import { ReviewNotFound } from "./errors";
import {
	getFeedCandidateRealmIdExpression,
	getFeedEligibilityCondition,
	hydrateFeedItems,
	type FeedEligibilityScope,
} from "../feed";
import { ContentLanguage, Uuid } from "../schema";
import { RecommendationPolicyVersionSchema } from "../recommendations/schema";
import { ValidationError } from "../errors";
import { applyNewPostTagMentionVotes } from "../../posts/tag-mentions";

const UnitReadFailureResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);

const ReviewListCursor = t.Object(
	{
		v: t.Literal(2),
		targetId: t.Nullable(Uuid),
		languages: t.Array(ContentLanguage, { maxItems: 50, uniqueItems: true }),
		localizationLanguages: t.Array(ContentLanguage, {
			maxItems: 50,
			uniqueItems: true,
		}),
		realmIds: t.Array(Uuid, { maxItems: 50, uniqueItems: true }),
		scoreRealmId: t.Nullable(Uuid),
		scores: t.Array(t.Integer({ minimum: 1, maximum: 10 }), {
			maxItems: 10,
			uniqueItems: true,
		}),
		sort: ReviewSortSchema,
		snapshotId: t.Nullable(Uuid),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		lastRankValue: t.Number(),
		lastCreatedAt: t.String({ format: "date-time" }),
		lastId: Uuid,
	},
	{ additionalProperties: false },
);
type ReviewListCursor = typeof ReviewListCursor.static;

function decodeReviewListCursor(value?: string) {
	if (!value) return undefined;
	try {
		return parseJsonCursor(value, ReviewListCursor);
	} catch {
		throw new InvalidPaginationCursor();
	}
}

function equalOrderedValues(
	left: readonly (number | string)[],
	right: readonly (number | string)[],
) {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateReviewListCursor(
	cursor: ReviewListCursor | undefined,
	query: ListReviewsQuery,
	scoreFilter: ReturnType<typeof resolveReviewScoreFilter>,
) {
	if (!cursor) return;
	const scoreRealmId = scoreFilter.status === "present" ? scoreFilter.realmId : null;
	const scores = scoreFilter.status === "present" ? scoreFilter.values : [];
	if (
		cursor.targetId !== (query.targetId ?? null) ||
		!equalOrderedValues(cursor.languages, query.languages ?? []) ||
		!equalOrderedValues(cursor.localizationLanguages, query.localizationLanguages ?? []) ||
		!equalOrderedValues(cursor.realmIds, query.realmIds ?? []) ||
		cursor.scoreRealmId !== scoreRealmId ||
		!equalOrderedValues(cursor.scores, scores) ||
		cursor.sort !== (query.sort ?? "best") ||
		cursor.limit !== (query.limit ?? 20) ||
		Number.isNaN(Date.parse(cursor.asOf))
	)
		throw new InvalidPaginationCursor();
}

function encodeReviewListCursor(value: ReviewListCursor) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export default new Elysia()
	.use(session)
	.group("/reviews", (app) =>
		app
			.get(
				"",
				async ({ query, request }) => {
					const identity = await resolveIdentity(request.headers, "unit:read");
					const viewer = await resolveRecommendationViewer(identity.profile?.unitId);
					const rankingViewer = { ...viewer, personalized: false };
					const scoreFilter = resolveReviewScoreFilter(query);
					if (scoreFilter.status === "invalid")
						throw new ValidationError({
							scores: "scores and scoreRealmId must be provided together",
						});
					const cursor = decodeReviewListCursor(query.cursor);
					validateReviewListCursor(cursor, query, scoreFilter);
					const snapshot = cursor?.snapshotId
						? await resolveRecommendationSnapshot(cursor.snapshotId)
						: cursor
							? null
							: await resolveRecommendationSnapshot();
					if (cursor?.snapshotId && !snapshot) throw new InvalidPaginationCursor();
					const snapshotContext = snapshot ?? fallbackRecommendationSnapshot;
					if (cursor && cursor.policyVersion !== snapshotContext.policyVersion)
						throw new InvalidPaginationCursor();
					const scopeBase = {
						content: ["post:review"] as const,
						...(query.realmIds?.length ? { realmIds: query.realmIds } : {}),
						...(query.languages?.length ? { languages: query.languages } : {}),
						...(query.localizationLanguages?.length
							? { localizationLanguages: query.localizationLanguages }
							: {}),
						...(query.targetId ? { subjectId: query.targetId } : {}),
					};
					const scope: FeedEligibilityScope =
						scoreFilter.status === "present"
							? {
									...scopeBase,
									reviewScore: {
										realmId: scoreFilter.realmId,
										values: scoreFilter.values,
									},
								}
							: scopeBase;
					const sort = query.sort ?? "best";
					const limit = query.limit ?? 20;
					const asOf = cursor ? new Date(cursor.asOf) : new Date();
					const snapshotJoin = snapshotContext.id
						? and(
								eq(recommendationUnitStat.snapshotId, snapshotContext.id),
								eq(recommendationUnitStat.unitId, unit.id),
								isNull(recommendationUnitStat.contextRealmId),
							)
						: sql`false`;
					const rankValue = recommendationObjectiveExpression(sort, asOf);
					const cursorCreatedAt = cursor ? new Date(cursor.lastCreatedAt) : undefined;
					const cursorCondition =
						cursor && cursorCreatedAt
							? or(
									lt(rankValue, cursor.lastRankValue),
									and(
										eq(rankValue, cursor.lastRankValue),
										lt(unit.createdAt, cursorCreatedAt),
									),
									and(
										eq(rankValue, cursor.lastRankValue),
										eq(unit.createdAt, cursorCreatedAt),
										lt(unit.id, cursor.lastId),
									),
								)
							: undefined;
					const [ranked, [total]] = await Promise.all([
						database
							.select({
								id: unit.id,
								subjectId: post.subjectUnitId,
								realmId: getFeedCandidateRealmIdExpression(
									rankingViewer,
									scope.realmIds,
								),
								rankValue,
								createdAt: unit.createdAt,
							})
							.from(unit)
							.leftJoin(post, eq(post.id, unit.id))
							.leftJoin(recommendationUnitStat, snapshotJoin)
							.where(
								and(
									getFeedEligibilityCondition(rankingViewer, scope, asOf),
									cursorCondition,
								),
							)
							.orderBy(desc(rankValue), desc(unit.createdAt), desc(unit.id))
							.limit(limit + 1),
						database
							.select({ value: count() })
							.from(unit)
							.leftJoin(post, eq(post.id, unit.id))
							.where(getFeedEligibilityCondition(rankingViewer, scope, asOf)),
					]);
					const page = ranked.slice(0, limit);
					const hydrated = await hydrateFeedItems(page, rankingViewer, scope, asOf, {
						kind: "contextual",
					});
					const reviewMetadata = new Map(
						page.flatMap((item) =>
							item.subjectId
								? [
										[
											item.id,
											{
												targetId: item.subjectId,
											},
										] as const,
									]
								: [],
						),
					);
					const last = page.at(-1);
					const scoreRealmId =
						scoreFilter.status === "present" ? scoreFilter.realmId : null;
					const scores = scoreFilter.status === "present" ? scoreFilter.values : [];
					return {
						totalCount: toSafeInteger(total?.value ?? 0, "review count"),
						nextCursor:
							ranked.length > limit && last
								? encodeReviewListCursor({
										v: 2,
										targetId: query.targetId ?? null,
										languages: query.languages ?? [],
										localizationLanguages: query.localizationLanguages ?? [],
										realmIds: query.realmIds ?? [],
										scoreRealmId,
										scores: [...scores],
										sort,
										snapshotId: snapshotContext.id,
										policyVersion: snapshotContext.policyVersion,
										limit,
										asOf: asOf.toISOString(),
										lastRankValue: last.rankValue,
										lastCreatedAt: last.createdAt.toISOString(),
										lastId: last.id,
									})
								: null,
						items: hydrated.flatMap((item) => {
							if (item.itemType !== "post" || item.postKind !== "review") return [];
							const metadata = reviewMetadata.get(item.id);
							if (!metadata) return [];
							return [
								{
									...item,
									...metadata,
								},
							];
						}),
					};
				},
				{
					query: ListReviewsQuery,
					response: {
						[StatusCodes.OK]: ReviewListResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
					},
					detail: { summary: "List reviews", tags: ["Reviews"] },
				},
			)
			.post(
				"",
				async ({ profile, authorization, body }) => {
					await authorization.unit.ensureCanRead(body.targetId);
					await authorization.realm.ensureUnitCreation(
						body.publishRealmIds,
						"realm.units.create",
					);
					await authorization.realm.ensureParticipation(body.score?.realmId);
					const id = await database.transaction(async (tx) => {
						if (body.progressEntryId) {
							const [progressEntry] = await tx
								.select({ id: unitProgressEntry.id })
								.from(unitProgressEntry)
								.where(
									and(
										eq(unitProgressEntry.id, body.progressEntryId),
										eq(unitProgressEntry.profileId, profile.unitId),
										eq(unitProgressEntry.unitId, body.targetId),
										isNull(unitProgressEntry.deletedAt),
									),
								)
								.limit(1)
								.for("update");
							if (!progressEntry)
								throw new ValidationError({
									progressEntryId:
										"Progress entry must belong to the current Profile and Review target",
								});
							const [existingBinding] = await tx
								.select({ postId: postProgressEntry.postId })
								.from(postProgressEntry)
								.where(eq(postProgressEntry.progressEntryId, body.progressEntryId))
								.limit(1);
							if (existingBinding)
								throw new ValidationError({
									progressEntryId: "Progress entry already has a Review",
								});
						}
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
							realmIds: body.publishRealmIds,
						});
						await tx.insert(post).values({
							id: created.id,
							subjectUnitId: body.targetId,
							kind: "review",
						});
						await tx.insert(unitLocalization).values({
							unitId: created.id,
							language: body.language,
							title: body.title ?? null,
							summary: body.summary ?? null,
							content: body.body,
							contentStatus: "published",
						});
						await applyNewPostTagMentionVotes(tx, {
							postId: created.id,
							profileId: profile.unitId,
							nextBody: body.body,
						});
						await tx.insert(unitOwnership).values({
							unitId: created.id,
							profileId: profile.unitId,
							assignedByProfileId: profile.unitId,
						});
						await createProfilePublisherAttribution(tx, {
							sourceUnitId: created.id,
							profileId: profile.unitId,
						});
						if (body.score) {
							const storedScore = await upsertScore(
								tx,
								profile.unitId,
								body.targetId,
								body.score.realmId,
								body.score.value,
							);
							await tx.insert(postScore).values({
								postId: created.id,
								scoreId: storedScore.id,
								position: fractionalPositionAt(0),
							});
						}
						if (body.progressEntryId)
							await tx.insert(postProgressEntry).values({
								postId: created.id,
								progressEntryId: body.progressEntryId,
								position: fractionalPositionAt(0),
							});
						await publishPostToRealms(tx, {
							postId: created.id,
							realmIds: body.publishRealmIds,
						});
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
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
					},
					detail: { summary: "Create review", tags: ["Reviews"] },
				},
			)
			.get(
				"/:reviewId",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request.headers, "unit:read");
					const { authorization } = identity;
					const viewerProfileId = identity.profile?.unitId;
					await authorization.unit.ensureCanRead(
						params.reviewId,
						() => new UnitNotFound("Review"),
					);
					const localizationLanguages = query.localizationLanguages ?? [];
					const [review] = await database
						.select({
							id: post.id,
							targetId: post.subjectUnitId,
							language: unitLocalization.language,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
							body: unitLocalization.content,
							replyCount: sql<unknown>`coalesce(${postReplyStat.undeletedDescendantCount}, 0)`,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.leftJoin(postReplyStat, eq(postReplyStat.postId, post.id))
						.innerJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								eq(
									unitLocalization.language,
									resolvedUnitLocalizationLanguage(
										post.id,
										localizationLanguages,
									),
								),
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
					const targetId = review.targetId;
					const subjectPromise = authorization.unit
						.canRead(targetId)
						.then((canRead) =>
							canRead
								? getPostSubjectPresentation(targetId, localizationLanguages)
								: null,
						);
					const [
						attributionMap,
						scores,
						progressEntries,
						subject,
						canEdit,
						canManageAttributions,
						accessDecision,
						canManageScores,
						replyCreationDecision,
						targetingLock,
					] = await Promise.all([
						getAttributionSummariesByUnitIds([review.id], localizationLanguages),
						selectPostScores(review.id, viewerProfileId, localizationLanguages).then(
							(items) =>
								items.map(({ scoreId, realmId, realmTitle, value }) => ({
									scoreId,
									realmId,
									realmTitle,
									value,
								})),
						),
						selectPostProgressEntry(review.id, viewerProfileId),
						subjectPromise,
						authorization.unit.canUpdate(params.reviewId, ["localizations"]),
						authorization.unit.canUpdate(params.reviewId, ["credit-attributions"]),
						authorization.unit.decide(params.reviewId, "unit.access.manage"),
						authorization.unit.canUpdate(params.reviewId, ["relations", "scores"]),
						query.realmId
							? authorization.unit.decide(query.realmId, "realm.post.replies.create")
							: Promise.resolve({ allowed: true } as const),
						findPostTargetingLock(database, {
							targets: [{ relation: "root", unitId: review.id }],
							...(query.realmId ? { realmId: query.realmId } : {}),
						}),
					]);
					return {
						...review,
						postKind: "review" as const,
						realmId: query.realmId ?? null,
						attributions: attributionMap.get(review.id) ?? [],
						targetId,
						body: review.body === null ? null : toPortableTextResponse(review.body),
						replyCount: toSafeInteger(review.replyCount, "reply count"),
						subject,
						scores,
						progressEntry: progressEntries[0]
							? {
									unitId: progressEntries[0].unitId,
									entryKind: progressEntries[0].entryKind,
									status: progressEntries[0].status,
									progress: progressEntries[0].progress,
									completionDelta: progressEntries[0].completionDelta,
									occurredAt: progressEntries[0].occurredAt,
									datePrecision: progressEntries[0].datePrecision,
								}
							: null,
						capabilities: {
							canEdit,
							canManageAttributions,
							canManageAccess: accessDecision.allowed,
							canManageScores,
							canReply: replyCreationDecision.allowed && !targetingLock,
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
						const [current] = await tx
							.select({ content: unitLocalization.content })
							.from(unitLocalization)
							.where(
								and(
									eq(unitLocalization.unitId, params.reviewId),
									isFirstUnitLocalization(unitLocalization.unitId),
								),
							)
							.for("update")
							.limit(1);
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
						await applyNewPostTagMentionVotes(tx, {
							postId: params.reviewId,
							profileId: profile.unitId,
							previousBody: current?.content,
							nextBody: body.body,
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
						[StatusCodes.CONFLICT]: toApiErrorResponse(["PostTagMentionVoteConflict"]),
					},
					detail: { summary: "Update review", tags: ["Reviews"] },
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
					const storedScore = await database.transaction((tx) =>
						upsertScore(
							tx,
							profile.unitId,
							params.targetId,
							body.realmId,
							body.score,
							body.visibility,
						),
					);
					return {
						scoreId: storedScore.id,
						score: body.score,
						visibility: storedScore.visibility,
					};
				},
				{
					access: "contribute:interaction:write",
					params: ScoreTargetParams,
					body: SetScoreBody,
					response: {
						[StatusCodes.OK]: ScoreResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
					},
					detail: { summary: "Score unit", tags: ["Reviews"] },
				},
			)
			.get(
				"/:targetId/viewer",
				async ({ params, profile, authorization, query }) => {
					await authorization.unit.ensureCanRead(params.targetId);
					const items = await database
						.select({
							scoreId: score.id,
							realmId: score.realmId,
							value: score.value,
							visibility: score.visibility,
							realmTitle: resolvedUnitLocalizationTitle(
								score.realmId,
								query.localizationLanguages,
							),
							updatedAt: score.updatedAt,
						})
						.from(score)
						.where(
							and(
								eq(score.profileId, profile.unitId),
								eq(score.unitId, params.targetId),
							),
						)
						.orderBy(desc(score.updatedAt), asc(score.realmId));
					return { items };
				},
				{
					access: "interaction:read",
					params: ScoreTargetParams,
					query: ListViewerScoresQuery,
					response: {
						[StatusCodes.OK]: ViewerScoreListResponse,
						[StatusCodes.NOT_FOUND]: UnitReadFailureResponse,
					},
					detail: {
						summary: "List current user's Scores for a Unit",
						tags: ["Reviews"],
					},
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
	);

import { StatusCodes } from "http-status-codes";
import { and, count, desc, eq, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia, { t } from "elysia";

import { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import {
	primaryUnitTitle,
	isPrimaryUnitLocalization,
	firstUnitLocalizationCoverAssetId,
} from "../../units/localization";
import {
	post,
	postReply,
	profile as profileTable,
	profileFollow,
	realmUnit,
	realmSubscription,
	recommendationProfileInterest,
	recommendationUnitEdge,
	recommendationUnitStat,
	unit,
	unitLocalization,
	unitReaction,
	unitRevisionHead,
} from "../../database/schema";
import { parseJsonCursor } from "../../pagination";
import {
	fallbackRecommendationSnapshot,
	resolveRecommendationSnapshot,
	resolveRecommendationViewer,
	type RecommendationViewer,
} from "../../recommendations/context";
import { RecommendationPolicy } from "../../recommendations/policy";
import {
	EmptyRecommendationStats,
	rankRecommendations,
	type RecommendationCandidate,
	type RecommendationStats,
} from "../../recommendations/ranking";
import { recommendationObjectiveExpression } from "../../recommendations/sql-ranking";
import { createRecommendationTracking } from "../../recommendations/tracking";
import { presentImageAsset } from "../../units/service";
import {
	RecommendationPolicyVersionSchema,
	type RecommendationReason,
	type RecommendationSurface,
} from "../recommendations/schema";
import { toApiErrorResponse, FeedResponse, toPortableTextResponse } from "../schema/response";
import { InvalidFeedCursor } from "./errors";
import {
	FeedQuery,
	FeedSortSchema,
	type FeedQuery as FeedQueryType,
	type FeedSort,
} from "./schema";

const preferredLocalization = alias(unitLocalization, "preferred_localization");

const FeedCursor = t.Object(
	{
		v: t.Literal(2),
		sort: FeedSortSchema,
		realmId: t.Nullable(t.String({ format: "uuid" })),
		subjectId: t.Nullable(t.String({ format: "uuid" })),
		personalized: t.Boolean(),
		snapshotId: t.Nullable(t.String({ format: "uuid" })),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		lastId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);
type FeedCursor = typeof FeedCursor.static;

function decodeCursor(value: string | undefined) {
	if (!value) return undefined;
	try {
		return parseJsonCursor(value, FeedCursor);
	} catch {
		throw new InvalidFeedCursor();
	}
}

function validateCursor(
	cursor: FeedCursor | undefined,
	query: FeedQueryType,
	personalized: boolean,
) {
	if (!cursor) return;
	if (
		cursor.sort !== (query.sort ?? "best") ||
		cursor.realmId !== (query.realmId ?? null) ||
		cursor.subjectId !== (query.subjectId ?? null) ||
		cursor.personalized !== personalized ||
		cursor.limit !== (query.limit ?? 20) ||
		Number.isNaN(Date.parse(cursor.asOf))
	)
		throw new InvalidFeedCursor();
}

export function getFeedEligibilityCondition(
	viewer: RecommendationViewer,
	query: Pick<FeedQueryType, "realmId" | "subjectId">,
	asOf: Date,
	anchorId?: string,
): SQL {
	return and(
		sql`${post.kind} in ('post'::post_kind, 'reply'::post_kind)`,
		eq(unit.status, "published"),
		eq(unit.visibility, "public"),
		eq(unit.moderationStatus, "approved"),
		isNull(unit.deletedAt),
		lte(unit.createdAt, asOf),
		sql`exists (
			select 1 from unit author_unit
			where author_unit.id = ${post.authorProfileId}
				and author_unit.status = 'published'
				and author_unit.visibility = 'public'
				and author_unit.moderation_status = 'approved'
				and author_unit.deleted_at is null
		)`,
		sql`(${post.kind} <> 'reply'::post_kind or exists (
			select 1 from post_reply readable_reply
			join unit readable_root on readable_root.id = readable_reply.root_post_id
			where readable_reply.post_id = ${post.id}
				and readable_root.status = 'published'
				and readable_root.visibility = 'public'
				and readable_root.moderation_status = 'approved'
				and readable_root.deleted_at is null
		))`,
		query.realmId
			? sql`exists (
				select 1 from realm_unit scoped_content
				where scoped_content.unit_id = ${post.id}
					and scoped_content.realm_id = ${query.realmId}::uuid
					and scoped_content.status = 'visible'
			)`
			: undefined,
		query.subjectId ? eq(post.subjectUnitId, query.subjectId) : undefined,
		viewer.contentRatings.length
			? inArray(unit.contentRating, viewer.contentRatings)
			: undefined,
		viewer.profileId
			? sql`not exists (
				select 1 from profile_block blocked
				where (blocked.blocker_profile_id = ${viewer.profileId}::uuid and blocked.blocked_profile_id = ${post.authorProfileId})
					or (blocked.blocker_profile_id = ${post.authorProfileId} and blocked.blocked_profile_id = ${viewer.profileId}::uuid)
			)`
			: undefined,
		viewer.profileId
			? sql`(${post.id} = ${anchorId ?? null}::uuid or not exists (
				select 1 from recommendation_exclusion excluded
				where excluded.profile_id = ${viewer.profileId}::uuid and excluded.unit_id = ${post.id}
			))`
			: undefined,
	)!;
}

export interface CandidateSources {
	ids: string[];
	relevance: Map<string, number>;
	reason: Map<string, RecommendationReason>;
}

type CandidateReason =
	CandidateSources["reason"] extends Map<string, infer Reason> ? Reason : never;

async function getCandidateSources(input: {
	viewer: RecommendationViewer;
	query: FeedQueryType;
	sort: FeedSort;
	snapshotId: string | null;
	asOf: Date;
	anchorId?: string;
}): Promise<CandidateSources> {
	const condition = getFeedEligibilityCondition(
		input.viewer,
		input.query,
		input.asOf,
		input.anchorId,
	);
	const snapshotJoin = input.snapshotId
		? and(
				eq(recommendationUnitStat.snapshotId, input.snapshotId),
				eq(recommendationUnitStat.unitId, post.id),
				isNull(recommendationUnitStat.contextRealmId),
			)
		: sql`false`;
	const objective = recommendationObjectiveExpression(input.sort, input.asOf);
	const objectiveLimit = input.viewer.personalized
		? RecommendationPolicy.maxObjectiveCandidates
		: RecommendationPolicy.maxCandidates - RecommendationPolicy.maxExplorationCandidates;
	const objectivePromise = database
		.select({
			id: post.id,
			engagement6h: recommendationUnitStat.engagement6h,
			engagement24h: recommendationUnitStat.engagement24h,
		})
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.leftJoin(recommendationUnitStat, snapshotJoin)
		.where(condition)
		.orderBy(desc(objective), desc(unit.createdAt), desc(unit.id))
		.limit(objectiveLimit);
	const recentPromise = database
		.select({ id: post.id })
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.where(condition)
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(RecommendationPolicy.maxExplorationCandidates);
	const graphScore = sql<number>`sum(${recommendationProfileInterest.weight} * ${recommendationUnitEdge.score})`;
	const graphPromise =
		input.viewer.personalized && input.viewer.profileId && input.snapshotId
			? database
					.select({ id: recommendationUnitEdge.targetUnitId, score: graphScore })
					.from(recommendationProfileInterest)
					.innerJoin(
						recommendationUnitEdge,
						and(
							eq(
								recommendationUnitEdge.snapshotId,
								recommendationProfileInterest.snapshotId,
							),
							eq(
								recommendationUnitEdge.sourceUnitId,
								recommendationProfileInterest.unitId,
							),
						),
					)
					.innerJoin(post, eq(post.id, recommendationUnitEdge.targetUnitId))
					.innerJoin(unit, eq(unit.id, post.id))
					.where(
						and(
							eq(recommendationProfileInterest.snapshotId, input.snapshotId),
							eq(recommendationProfileInterest.profileId, input.viewer.profileId),
							condition,
						),
					)
					.groupBy(recommendationUnitEdge.targetUnitId)
					.orderBy(desc(graphScore), desc(recommendationUnitEdge.targetUnitId))
					.limit(RecommendationPolicy.maxGraphCandidates)
			: Promise.resolve([]);
	const followedPromise =
		input.viewer.personalized && input.viewer.profileId
			? database
					.selectDistinct({ id: post.id, createdAt: unit.createdAt })
					.from(post)
					.innerJoin(unit, eq(unit.id, post.id))
					.innerJoin(
						profileFollow,
						and(
							eq(profileFollow.followerProfileId, input.viewer.profileId),
							eq(profileFollow.followedProfileId, post.authorProfileId),
						),
					)
					.where(condition)
					.orderBy(desc(unit.createdAt), desc(post.id))
					.limit(RecommendationPolicy.maxFollowCandidates)
			: Promise.resolve([]);
	const realmPromise =
		input.viewer.personalized && input.viewer.profileId
			? database
					.selectDistinct({ id: post.id, createdAt: unit.createdAt })
					.from(post)
					.innerJoin(unit, eq(unit.id, post.id))
					.innerJoin(
						realmUnit,
						and(eq(realmUnit.unitId, post.id), eq(realmUnit.status, "visible")),
					)
					.innerJoin(
						realmSubscription,
						and(
							eq(realmSubscription.profileId, input.viewer.profileId),
							eq(realmSubscription.realmId, realmUnit.realmId),
						),
					)
					.where(condition)
					.orderBy(desc(unit.createdAt), desc(post.id))
					.limit(RecommendationPolicy.maxFollowCandidates)
			: Promise.resolve([]);

	const [objectiveRows, recentRows, graphRows, followedRows, realmRows] = await Promise.all([
		objectivePromise,
		recentPromise,
		graphPromise,
		followedPromise,
		realmPromise,
	]);
	const relevance = new Map<string, number>();
	const reason = new Map<string, CandidateReason>();
	const addRanked = (
		rows: readonly { id: string }[],
		weight: number,
		nextReason: "followed_author" | "followed_realm" | "based_on_activity",
	) => {
		rows.forEach(({ id }, index) => {
			relevance.set(id, (relevance.get(id) ?? 0) + weight / (60 + index + 1));
			if (!reason.has(id)) reason.set(id, nextReason);
		});
	};
	addRanked(followedRows, 4, "followed_author");
	addRanked(realmRows, 4, "followed_realm");
	addRanked(graphRows, 4, "based_on_activity");
	for (const row of objectiveRows) {
		if (reason.has(row.id)) continue;
		if (input.sort === "new") {
			reason.set(row.id, "new_and_relevant");
			continue;
		}
		const popular =
			input.sort === "rising"
				? toNumber(row.engagement6h) > 0
				: toNumber(row.engagement24h) > 0;
		if (popular) reason.set(row.id, "popular_now");
	}
	for (const { id } of recentRows) if (!reason.has(id)) reason.set(id, "new_and_relevant");
	const personalIds = [...relevance.entries()]
		.sort((left, right) => right[1] - left[1] || right[0].localeCompare(left[0]))
		.slice(
			0,
			RecommendationPolicy.maxGraphCandidates + RecommendationPolicy.maxFollowCandidates,
		)
		.map(([id]) => id);
	return {
		ids: [
			...new Set([
				...personalIds,
				...objectiveRows.map(({ id }) => id),
				...recentRows.map(({ id }) => id),
			]),
		].slice(0, RecommendationPolicy.maxCandidates),
		relevance,
		reason,
	};
}

export interface FeedRankingCandidate extends RecommendationCandidate {
	postKind: "post" | "reply";
	authorId: string;
	realmId: string | null;
	subjectId: string | null;
	rootPostId: string | null;
	parentPostId: string | null;
}

function toNumber(value: number | null | undefined) {
	return Number(value ?? 0);
}

export async function getFeedRankingCandidates(input: {
	ids: string[];
	sources: CandidateSources;
	viewer: RecommendationViewer;
	query: FeedQueryType;
	snapshotId: string | null;
	asOf: Date;
	anchorId?: string;
}): Promise<FeedRankingCandidate[]> {
	if (!input.ids.length) return [];
	const selectedRealmId = input.query.realmId
		? sql<string>`${input.query.realmId}::uuid`
		: sql<string | null>`(
			select candidate_realm.realm_id from realm_unit candidate_realm
			where candidate_realm.unit_id = ${post.id}
				and candidate_realm.status = 'visible'
			order by
				${
					input.viewer.personalized && input.viewer.profileId
						? sql`case when exists (
					select 1 from realm_subscription preferred_realm
					where preferred_realm.profile_id = ${input.viewer.profileId}::uuid
						and preferred_realm.realm_id = candidate_realm.realm_id
				) then 0 else 1 end,`
						: sql``
				}
				candidate_realm.created_at desc, candidate_realm.realm_id
			limit 1
		)`;
	const snapshotJoin = input.snapshotId
		? and(
				eq(recommendationUnitStat.snapshotId, input.snapshotId),
				eq(recommendationUnitStat.unitId, post.id),
				isNull(recommendationUnitStat.contextRealmId),
			)
		: sql`false`;
	const preferredLanguage = input.viewer.preferredLanguages.length
		? sql<boolean>`exists (
			select 1 from ${unitLocalization} ${preferredLocalization}
			where ${preferredLocalization.unitId} = ${post.id}
				and ${inArray(preferredLocalization.language, input.viewer.preferredLanguages)}
		)`
		: sql<boolean>`false`;
	const rows = await database
		.select({
			id: post.id,
			postKind: post.kind,
			authorId: post.authorProfileId,
			realmId: selectedRealmId,
			subjectId: post.subjectUnitId,
			rootPostId: postReply.rootPostId,
			parentPostId: postReply.parentPostId,
			createdAt: unit.createdAt,
			preferredLanguage,
			impressions: recommendationUnitStat.impressions,
			opens: recommendationUnitStat.opens,
			dwell30s: recommendationUnitStat.dwell30s,
			upvotes: recommendationUnitStat.upvotes,
			downvotes: recommendationUnitStat.downvotes,
			replies: recommendationUnitStat.replies,
			favorites: recommendationUnitStat.favorites,
			shares: recommendationUnitStat.shares,
			highScores: recommendationUnitStat.highScores,
			activeProgress: recommendationUnitStat.activeProgress,
			completions: recommendationUnitStat.completions,
			negativeProgress: recommendationUnitStat.negativeProgress,
			engagement6h: recommendationUnitStat.engagement6h,
			engagement24h: recommendationUnitStat.engagement24h,
			engagement7d: recommendationUnitStat.engagement7d,
		})
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.leftJoin(postReply, eq(postReply.postId, post.id))
		.leftJoin(recommendationUnitStat, snapshotJoin)
		.where(
			and(
				inArray(post.id, input.ids),
				getFeedEligibilityCondition(input.viewer, input.query, input.asOf, input.anchorId),
			),
		);
	return rows.flatMap((row): FeedRankingCandidate[] => {
		if (row.postKind !== "post" && row.postKind !== "reply") return [];
		const stats: RecommendationStats = {
			...EmptyRecommendationStats,
			impressions: toNumber(row.impressions),
			opens: toNumber(row.opens),
			dwell30s: toNumber(row.dwell30s),
			upvotes: toNumber(row.upvotes),
			downvotes: toNumber(row.downvotes),
			replies: toNumber(row.replies),
			favorites: toNumber(row.favorites),
			shares: toNumber(row.shares),
			highScores: toNumber(row.highScores),
			activeProgress: toNumber(row.activeProgress),
			completions: toNumber(row.completions),
			negativeProgress: toNumber(row.negativeProgress),
			engagement6h: toNumber(row.engagement6h),
			engagement24h: toNumber(row.engagement24h),
			engagement7d: toNumber(row.engagement7d),
		};
		return [
			{
				id: row.id,
				postKind: row.postKind,
				authorId: row.authorId,
				realmId: row.realmId,
				subjectId: row.subjectId,
				rootPostId: row.rootPostId,
				parentPostId: row.parentPostId,
				createdAt: row.createdAt,
				personalizedRelevance:
					(input.sources.relevance.get(row.id) ?? 0) +
					(input.viewer.personalized && row.preferredLanguage ? 0.05 : 0),
				stats,
			},
		];
	});
}

type RankedFeedCandidate = ReturnType<typeof rankRecommendations<FeedRankingCandidate>>[number];

export async function hydrateFeedItems(
	page: readonly RankedFeedCandidate[],
	viewer: RecommendationViewer,
	query: Pick<FeedQueryType, "realmId" | "subjectId">,
	asOf: Date,
	reasons: CandidateSources["reason"],
	surface: RecommendationSurface,
	requestId: string,
	positionOffset: number,
	policyVersion: string,
) {
	const pageIds = page.map(({ id }) => id);
	if (!pageIds.length) return [];
	const rows = await database
		.select({
			id: post.id,
			postKind: post.kind,
			authorId: post.authorProfileId,
			authorName: primaryUnitTitle(profileTable.id),
			subjectId: post.subjectUnitId,
			rootPostId: postReply.rootPostId,
			parentPostId: postReply.parentPostId,
			body: unitLocalization.content,
			title: unitLocalization.title,
			latestRevisionId: unitRevisionHead.revisionId,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.innerJoin(profileTable, eq(profileTable.id, post.authorProfileId))
		.leftJoin(postReply, eq(postReply.postId, post.id))
		.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, post.id))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, post.id),
				isPrimaryUnitLocalization(unitLocalization.unitId),
			),
		)
		.where(and(inArray(post.id, pageIds), getFeedEligibilityCondition(viewer, query, asOf)));
	if (!rows.length) return [];
	const validIds = rows.map(({ id }) => id);
	const postIds = rows.filter(({ postKind }) => postKind === "post").map(({ id }) => id);
	const replyIds = rows.filter(({ postKind }) => postKind === "reply").map(({ id }) => id);
	const subjectIds = [
		...new Set(rows.flatMap(({ subjectId }) => (subjectId ? [subjectId] : []))),
	];
	const rootIds = [
		...new Set(rows.flatMap(({ rootPostId }) => (rootPostId ? [rootPostId] : []))),
	];
	const [rootReplyCounts, childReplyCounts, reactions, viewerReactions, subjectRows, rootRows] =
		await Promise.all([
			postIds.length
				? database
						.select({ id: postReply.rootPostId, count: count() })
						.from(postReply)
						.innerJoin(unit, eq(unit.id, postReply.postId))
						.where(
							and(
								inArray(postReply.rootPostId, postIds),
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
								eq(unit.moderationStatus, "approved"),
								isNull(unit.deletedAt),
							),
						)
						.groupBy(postReply.rootPostId)
				: [],
			replyIds.length
				? database
						.select({ id: postReply.parentPostId, count: count() })
						.from(postReply)
						.innerJoin(unit, eq(unit.id, postReply.postId))
						.where(
							and(
								inArray(postReply.parentPostId, replyIds),
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
								eq(unit.moderationStatus, "approved"),
								isNull(unit.deletedAt),
							),
						)
						.groupBy(postReply.parentPostId)
				: [],
			database
				.select({
					unitId: unitReaction.unitId,
					reaction: unitReaction.reaction,
					count: count(),
				})
				.from(unitReaction)
				.where(inArray(unitReaction.unitId, validIds))
				.groupBy(unitReaction.unitId, unitReaction.reaction),
			viewer.profileId
				? database
						.select({
							unitId: unitReaction.unitId,
							realmId: unitReaction.realmId,
							reaction: unitReaction.reaction,
						})
						.from(unitReaction)
						.where(
							and(
								eq(unitReaction.profileId, viewer.profileId),
								inArray(unitReaction.unitId, validIds),
							),
						)
				: [],
			subjectIds.length
				? database
						.select({
							id: unit.id,
							type: unit.kind,
							slug: unit.slug,
							title: unitLocalization.title,
							coverAssetId: firstUnitLocalizationCoverAssetId(unit.id),
						})
						.from(unit)
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, unit.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.where(
							and(
								inArray(unit.id, subjectIds),
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
								eq(unit.moderationStatus, "approved"),
								isNull(unit.deletedAt),
							),
						)
				: [],
			rootIds.length
				? database
						.select({
							rootPostId: post.id,
							title: unitLocalization.title,
							authorId: post.authorProfileId,
							authorName: primaryUnitTitle(profileTable.id),
							subjectId: post.subjectUnitId,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.innerJoin(profileTable, eq(profileTable.id, post.authorProfileId))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.where(
							and(
								inArray(post.id, rootIds),
								getFeedEligibilityCondition(viewer, {}, asOf),
							),
						)
				: [],
		]);
	const subjects = new Map(
		await Promise.all(
			subjectRows.map(
				async ({ coverAssetId, ...subject }) =>
					[
						subject.id,
						{
							...subject,
							cover: presentImageAsset(coverAssetId),
						},
					] as const,
			),
		),
	);
	const rowMap = new Map(rows.map((row) => [row.id, row]));
	const pageMap = new Map(page.map((item) => [item.id, item]));
	const rootContext = new Map(rootRows.map((row) => [row.rootPostId, row]));
	const rootCount = new Map(rootReplyCounts.map((row) => [row.id, Number(row.count)]));
	const childCount = new Map(childReplyCounts.map((row) => [row.id, Number(row.count)]));
	const reactionCount = new Map(
		reactions.map((row) => [`${row.unitId}:${row.reaction}`, Number(row.count)]),
	);
	const ownReaction = new Map(
		viewerReactions.map((row) => [`${row.unitId}:${row.realmId ?? ""}`, row.reaction]),
	);
	return pageIds.flatMap((id, index) => {
		const row = rowMap.get(id);
		const ranked = pageMap.get(id);
		if (!row || !ranked || (row.postKind !== "post" && row.postKind !== "reply")) return [];
		return [
			{
				id: row.id,
				postKind: row.postKind,
				authorId: row.authorId,
				authorName: row.authorName,
				realmId: ranked.realmId,
				subjectId: row.subjectId,
				rootPostId: row.rootPostId,
				parentPostId: row.parentPostId,
				body: toPortableTextResponse(row.body),
				replyCount:
					row.postKind === "reply"
						? (childCount.get(row.id) ?? 0)
						: (rootCount.get(row.id) ?? 0),
				title: row.title,
				latestRevisionId: row.latestRevisionId,
				replyContext: row.rootPostId ? (rootContext.get(row.rootPostId) ?? null) : null,
				subject: row.subjectId ? (subjects.get(row.subjectId) ?? null) : null,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				reactions: {
					upvote: reactionCount.get(`${row.id}:upvote`) ?? 0,
					downvote: reactionCount.get(`${row.id}:downvote`) ?? 0,
				},
				viewerReaction: ownReaction.get(`${row.id}:${ranked.realmId ?? ""}`) ?? null,
				recommendationReason: reasons.get(row.id) ?? null,
				tracking: createRecommendationTracking(row.id, {
					requestId,
					surface,
					position: positionOffset + index,
					policyVersion,
				}),
			},
		];
	});
}

export default new Elysia({ prefix: "/feed" }).get(
	"",
	async ({ query, request }) => {
		const identity = await resolveIdentity(request.headers, "unit:read");
		const viewer = await resolveRecommendationViewer(
			identity.profile?.unitId,
			query.personalized,
		);
		const cursor = decodeCursor(query.cursor);
		validateCursor(cursor, query, viewer.personalized);
		const snapshot = cursor?.snapshotId
			? await resolveRecommendationSnapshot(cursor.snapshotId)
			: cursor
				? null
				: await resolveRecommendationSnapshot();
		if (cursor?.snapshotId && !snapshot) throw new InvalidFeedCursor();
		const snapshotContext = snapshot ?? fallbackRecommendationSnapshot;
		if (cursor && cursor.policyVersion !== snapshotContext.policyVersion)
			throw new InvalidFeedCursor();
		const sort = query.sort ?? "best";
		const asOf = cursor ? new Date(cursor.asOf) : new Date();
		const sources = await getCandidateSources({
			viewer,
			query,
			sort,
			snapshotId: snapshotContext.id,
			asOf,
			...(cursor ? { anchorId: cursor.lastId } : {}),
		});
		const candidates = await getFeedRankingCandidates({
			ids: sources.ids,
			sources,
			viewer,
			query,
			snapshotId: snapshotContext.id,
			asOf,
			...(cursor ? { anchorId: cursor.lastId } : {}),
		});
		const ranked = rankRecommendations(candidates, {
			sort,
			personalized: viewer.personalized,
			asOf,
			pageSize: query.limit ?? 20,
			...(query.realmId ? { scopedRealmId: query.realmId } : {}),
		});
		const start = cursor ? ranked.findIndex(({ id }) => id === cursor.lastId) + 1 : 0;
		if (cursor && start === 0) throw new InvalidFeedCursor();
		const limit = query.limit ?? 20;
		const page = ranked.slice(start, start + limit);
		const requestId = crypto.randomUUID();
		const items = await hydrateFeedItems(
			page,
			viewer,
			query,
			asOf,
			sources.reason,
			"home_feed",
			requestId,
			start,
			snapshotContext.policyVersion,
		);
		const last = page.at(-1);
		return {
			items,
			nextCursor:
				start + page.length < ranked.length && last
					? Buffer.from(
							JSON.stringify({
								v: 2,
								sort,
								realmId: query.realmId ?? null,
								subjectId: query.subjectId ?? null,
								personalized: viewer.personalized,
								snapshotId: snapshotContext.id,
								policyVersion: snapshotContext.policyVersion,
								limit,
								asOf: asOf.toISOString(),
								lastId: last.id,
							}),
						).toString("base64url")
					: null,
		};
	},
	{
		query: FeedQuery,
		response: {
			[StatusCodes.OK]: FeedResponse,
			[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidFeedCursor"]),
		},
		detail: { summary: "Ranked realm feed", tags: ["Feed"] },
	},
);

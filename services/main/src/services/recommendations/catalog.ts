import { and, desc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";

import { database } from "../database";
import { unitCoverAssetId } from "../database/localization";
import {
	recommendationProfileInterest,
	recommendationUnitEdge,
	recommendationUnitStat,
	unit,
	unitLocalization,
} from "../database/schema";
import type { RecommendationReason, RecommendationSurface } from "../api/recommendations/schema";
import { presentImageAsset } from "../units/service";
import type { RecommendationSnapshotContext, RecommendationViewer } from "./context";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";
import {
	EmptyRecommendationStats,
	rankRecommendations,
	type RecommendationCandidate,
	type RecommendationStats,
} from "./ranking";
import { recommendationObjectiveExpression } from "./sql-ranking";
import { createRecommendationTracking } from "./tracking";

export type RecommendedUnitKind = "book" | "software" | "media";

interface CatalogCandidate extends RecommendationCandidate {
	kind: RecommendedUnitKind;
}

function eligibleCatalogUnit(input: {
	viewer: RecommendationViewer;
	type?: RecommendedUnitKind;
	seedUnitId?: string;
	asOf: Date;
	afterId?: string;
}) {
	return and(
		inArray(unit.kind, input.type ? [input.type] : ["book", "software", "media"]),
		eq(unit.status, "published"),
		eq(unit.visibility, "public"),
		eq(unit.moderationStatus, "approved"),
		isNull(unit.deletedAt),
		lte(unit.createdAt, input.asOf),
		input.seedUnitId ? ne(unit.id, input.seedUnitId) : undefined,
		input.viewer.contentRatings.length
			? inArray(unit.contentRating, input.viewer.contentRatings)
			: undefined,
		input.viewer.profileId
			? sql`(${unit.id} = ${input.afterId ?? null}::uuid or not exists (
				select 1 from recommendation_exclusion excluded
				where excluded.profile_id = ${input.viewer.profileId}::uuid
					and excluded.unit_id = ${unit.id}
			))`
			: undefined,
	);
}

function number(value: number | null) {
	return Number(value ?? 0);
}

function surface(kind: RecommendedUnitKind, related: boolean): RecommendationSurface {
	if (related) return "unit_related";
	if (kind === "book") return "home_book";
	if (kind === "software") return "home_software";
	return "home_media";
}

function selectLocalization(
	rows: readonly {
		unitId: string;
		language: string;
		position: string;
		title: string | null;
		summary: string | null;
	}[],
	preferredLanguages: readonly string[],
) {
	return [...rows].sort((left, right) => {
		const leftPreferred = preferredLanguages.indexOf(left.language);
		const rightPreferred = preferredLanguages.indexOf(right.language);
		const leftRank = leftPreferred >= 0 ? leftPreferred : 10_000;
		const rightRank = rightPreferred >= 0 ? rightPreferred : 10_000;
		return (
			leftRank - rightRank ||
			left.position.localeCompare(right.position) ||
			left.language.localeCompare(right.language)
		);
	})[0];
}

export async function recommendUnits(input: {
	viewer: RecommendationViewer;
	snapshot: RecommendationSnapshotContext | null;
	type?: RecommendedUnitKind;
	seedUnitId?: string;
	asOf: Date;
	pageSize: number;
	afterId?: string;
	requestId: string;
}) {
	const snapshotId = input.snapshot?.id;
	const condition = eligibleCatalogUnit(input);
	const statJoin = snapshotId
		? and(
				eq(recommendationUnitStat.snapshotId, snapshotId),
				eq(recommendationUnitStat.unitId, unit.id),
				isNull(recommendationUnitStat.contextRealmId),
			)
		: sql`false`;
	const objective = recommendationObjectiveExpression("best", input.asOf);
	const objectivePromise = database
		.select({ id: unit.id, activity: recommendationUnitStat.engagement24h })
		.from(unit)
		.leftJoin(recommendationUnitStat, statJoin)
		.where(condition)
		.orderBy(desc(objective), desc(unit.createdAt), desc(unit.id))
		.limit(RecommendationPolicy.maxObjectiveCandidates);
	const recentPromise = database
		.select({ id: unit.id })
		.from(unit)
		.where(condition)
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(RecommendationPolicy.maxExplorationCandidates);
	const seedPromise =
		snapshotId && input.seedUnitId
			? database
					.select({
						id: recommendationUnitEdge.targetUnitId,
						score: recommendationUnitEdge.score,
					})
					.from(recommendationUnitEdge)
					.innerJoin(unit, eq(unit.id, recommendationUnitEdge.targetUnitId))
					.where(
						and(
							eq(recommendationUnitEdge.snapshotId, snapshotId),
							eq(recommendationUnitEdge.sourceUnitId, input.seedUnitId),
							condition,
						),
					)
					.orderBy(recommendationUnitEdge.rank, recommendationUnitEdge.targetUnitId)
					.limit(RecommendationPolicy.maxGraphCandidates)
			: Promise.resolve([]);
	const profileScore = sql<number>`sum(${recommendationProfileInterest.weight} * ${recommendationUnitEdge.score})`;
	const profilePromise =
		snapshotId && input.viewer.personalized && input.viewer.profileId
			? database
					.select({ id: recommendationUnitEdge.targetUnitId, score: profileScore })
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
					.innerJoin(unit, eq(unit.id, recommendationUnitEdge.targetUnitId))
					.where(
						and(
							eq(recommendationProfileInterest.snapshotId, snapshotId),
							eq(recommendationProfileInterest.profileId, input.viewer.profileId),
							condition,
						),
					)
					.groupBy(recommendationUnitEdge.targetUnitId)
					.orderBy(desc(profileScore), desc(recommendationUnitEdge.targetUnitId))
					.limit(RecommendationPolicy.maxGraphCandidates)
			: Promise.resolve([]);
	const [objectiveRows, recentRows, seedRows, profileRows] = await Promise.all([
		objectivePromise,
		recentPromise,
		seedPromise,
		profilePromise,
	]);
	const relevance = new Map<string, number>();
	const reasons = new Map<string, RecommendationReason>();
	for (const row of seedRows) {
		relevance.set(row.id, (relevance.get(row.id) ?? 0) + Number(row.score) * 2);
		reasons.set(row.id, "related_subject");
	}
	for (const row of profileRows) {
		relevance.set(row.id, (relevance.get(row.id) ?? 0) + Number(row.score));
		if (!reasons.has(row.id)) reasons.set(row.id, "based_on_activity");
	}
	for (const { id, activity } of objectiveRows)
		if (!reasons.has(id) && Number(activity) > 0) reasons.set(id, "popular_now");
	for (const { id } of recentRows) if (!reasons.has(id)) reasons.set(id, "new_and_relevant");
	const ids = [
		...new Set([
			...seedRows.map(({ id }) => id),
			...profileRows.map(({ id }) => id),
			...objectiveRows.map(({ id }) => id),
			...recentRows.map(({ id }) => id),
		]),
	].slice(0, RecommendationPolicy.maxCandidates);
	if (!ids.length) return { items: [], nextId: undefined };
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			createdAt: unit.createdAt,
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
		.from(unit)
		.leftJoin(recommendationUnitStat, statJoin)
		.where(and(inArray(unit.id, ids), condition));
	const candidates = rows.flatMap((row): CatalogCandidate[] => {
		if (row.kind !== "book" && row.kind !== "software" && row.kind !== "media") return [];
		const stats: RecommendationStats = {
			...EmptyRecommendationStats,
			impressions: number(row.impressions),
			opens: number(row.opens),
			dwell30s: number(row.dwell30s),
			upvotes: number(row.upvotes),
			downvotes: number(row.downvotes),
			replies: number(row.replies),
			favorites: number(row.favorites),
			shares: number(row.shares),
			highScores: number(row.highScores),
			activeProgress: number(row.activeProgress),
			completions: number(row.completions),
			negativeProgress: number(row.negativeProgress),
			engagement6h: number(row.engagement6h),
			engagement24h: number(row.engagement24h),
			engagement7d: number(row.engagement7d),
		};
		return [
			{
				...row,
				kind: row.kind,
				personalizedRelevance: relevance.get(row.id) ?? 0,
				stats,
			},
		];
	});
	const ranked = rankRecommendations(candidates, {
		sort: "best",
		personalized: input.viewer.personalized || Boolean(input.seedUnitId),
		asOf: input.asOf,
		pageSize: input.pageSize,
	});
	const start = input.afterId ? ranked.findIndex(({ id }) => id === input.afterId) + 1 : 0;
	if (input.afterId && start === 0) return null;
	const page = ranked.slice(start, start + input.pageSize);
	const pageIds = page.map(({ id }) => id);
	const [details, localizations] = await Promise.all([
		database
			.select({
				id: unit.id,
				kind: unit.kind,
				slug: unit.slug,
				contentRating: unit.contentRating,
				publishedAt: unit.publishedAt,
				createdAt: unit.createdAt,
				updatedAt: unit.updatedAt,
				coverAssetId: unitCoverAssetId(unit.id),
			})
			.from(unit)
			.where(and(inArray(unit.id, pageIds), condition)),
		database
			.select({
				unitId: unitLocalization.unitId,
				language: unitLocalization.language,
				position: unitLocalization.position,
				title: unitLocalization.title,
				summary: unitLocalization.summary,
			})
			.from(unitLocalization)
			.innerJoin(unit, eq(unit.id, unitLocalization.unitId))
			.where(and(inArray(unitLocalization.unitId, pageIds), condition)),
	]);
	const detailById = new Map(details.map((detail) => [detail.id, detail]));
	const localizationById = Map.groupBy(localizations, ({ unitId }) => unitId);
	const items = await Promise.all(
		page.flatMap((ranked, index) => {
			const detail = detailById.get(ranked.id);
			if (
				!detail ||
				(detail.kind !== "book" && detail.kind !== "software" && detail.kind !== "media")
			)
				return [];
			const kind = detail.kind;
			const localization = selectLocalization(
				localizationById.get(detail.id) ?? [],
				input.viewer.preferredLanguages,
			);
			return [
				(async () => ({
					id: detail.id,
					type: kind,
					slug: detail.slug,
					language: localization?.language ?? null,
					contentRating: detail.contentRating,
					publishedAt: detail.publishedAt,
					createdAt: detail.createdAt,
					updatedAt: detail.updatedAt,
					title: localization?.title ?? null,
					summary: localization?.summary ?? null,
					cover: presentImageAsset(detail.coverAssetId),
					recommendationReason: reasons.get(detail.id) ?? null,
					tracking: createRecommendationTracking(detail.id, {
						requestId: input.requestId,
						surface: surface(kind, Boolean(input.seedUnitId)),
						position: start + index,
						policyVersion: input.snapshot?.policyVersion ?? RecommendationPolicyVersion,
					}),
				}))(),
			];
		}),
	);
	return {
		items,
		nextId: start + page.length < ranked.length ? page.at(-1)?.id : undefined,
	};
}

import { and, desc, eq, exists, inArray, isNull, lte, not, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import { resolvedUnitLocalizationImageAssetId } from "../units/localization";
import { compareFractionalPositions } from "../ordering/position";
import {
	recommendationProfileInterest,
	recommendationUnitEdge,
	recommendationUnitStat,
	unit,
	unitLocalization,
	unitVariant,
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
import { recommendationObjectiveOrder } from "./sql-ranking";
import { createRecommendationTracking } from "./tracking";

export type RecommendedUnitKind = "book" | "software" | "media";

interface UnitCandidate extends RecommendationCandidate {
	kind: RecommendedUnitKind;
}

function eligibleUnit(input: {
	viewer: RecommendationViewer;
	type?: RecommendedUnitKind;
	seedUnitIds?: readonly string[];
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
		input.seedUnitIds?.length ? not(inArray(unit.id, [...input.seedUnitIds])) : undefined,
		not(
			exists(
				database
					.select({ id: unitVariant.variantUnitId })
					.from(unitVariant)
					.where(eq(unitVariant.variantUnitId, unit.id)),
			),
		),
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
		language: ContentLanguage;
		position: string;
		title: string | null;
		summary: string | null;
	}[],
	preferredLanguages: readonly ContentLanguage[],
) {
	return [...rows].sort((left, right) => {
		const leftPreferred = preferredLanguages.indexOf(left.language);
		const rightPreferred = preferredLanguages.indexOf(right.language);
		const leftRank = leftPreferred >= 0 ? leftPreferred : 10_000;
		const rightRank = rightPreferred >= 0 ? rightPreferred : 10_000;
		return (
			leftRank - rightRank ||
			compareFractionalPositions(left.position, right.position) ||
			left.language.localeCompare(right.language)
		);
	})[0];
}

export async function recommendUnits(input: {
	viewer: RecommendationViewer;
	snapshot: RecommendationSnapshotContext | null;
	type?: RecommendedUnitKind;
	seedUnitId?: string;
	inheritedSeedUnitId?: string;
	asOf: Date;
	pageSize: number;
	localizationLanguages: readonly ContentLanguage[];
	afterId?: string;
	requestId: string;
}) {
	const snapshotId = input.snapshot?.id;
	const seedUnitIds = [input.seedUnitId, input.inheritedSeedUnitId].filter(
		(value): value is string => Boolean(value),
	);
	const condition = eligibleUnit({ ...input, seedUnitIds });
	const statJoin = snapshotId
		? and(
				eq(recommendationUnitStat.snapshotId, snapshotId),
				eq(recommendationUnitStat.unitId, unit.id),
				isNull(recommendationUnitStat.contextRealmId),
			)
		: sql`false`;
	const objectivePromise = snapshotId
		? database
				.select({
					id: recommendationUnitStat.unitId,
					activity: recommendationUnitStat.engagement24h,
				})
				.from(recommendationUnitStat)
				.innerJoin(unit, eq(unit.id, recommendationUnitStat.unitId))
				.where(
					and(
						eq(recommendationUnitStat.snapshotId, snapshotId),
						isNull(recommendationUnitStat.contextRealmId),
						condition,
					),
				)
				.orderBy(...recommendationObjectiveOrder("best"))
				.limit(RecommendationPolicy.maxObjectiveCandidates)
		: database
				.select({ id: unit.id, activity: sql<number | null>`null` })
				.from(unit)
				.where(condition)
				.orderBy(desc(unit.createdAt), desc(unit.id))
				.limit(RecommendationPolicy.maxObjectiveCandidates);
	const recentPromise = database
		.select({ id: unit.id })
		.from(unit)
		.where(condition)
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(RecommendationPolicy.maxExplorationCandidates);
	const directSeedPromise =
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
	const inheritedSeedPromise =
		snapshotId && input.inheritedSeedUnitId && input.inheritedSeedUnitId !== input.seedUnitId
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
							eq(recommendationUnitEdge.sourceUnitId, input.inheritedSeedUnitId),
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
	const [objectiveRows, recentRows, directSeedRows, inheritedSeedRows, profileRows] =
		await Promise.all([
			objectivePromise,
			recentPromise,
			directSeedPromise,
			inheritedSeedPromise,
			profilePromise,
		]);
	const relevance = new Map<string, number>();
	const reasons = new Map<string, RecommendationReason>();
	for (const row of inheritedSeedRows) {
		relevance.set(row.id, (relevance.get(row.id) ?? 0) + Number(row.score));
		reasons.set(row.id, "related_subject");
	}
	for (const row of directSeedRows) {
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
			...directSeedRows.map(({ id }) => id),
			...inheritedSeedRows.map(({ id }) => id),
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
	const candidates = rows.flatMap((row): UnitCandidate[] => {
		if (row.kind !== "book" && row.kind !== "software" && row.kind !== "media") return [];
		const stats: RecommendationStats = {
			...EmptyRecommendationStats,
			impressions: toSafeInteger(row.impressions ?? 0n, "recommendation impressions"),
			opens: toSafeInteger(row.opens ?? 0n, "recommendation opens"),
			dwell30s: toSafeInteger(row.dwell30s ?? 0n, "recommendation dwell count"),
			upvotes: toSafeInteger(row.upvotes ?? 0n, "recommendation upvotes"),
			downvotes: toSafeInteger(row.downvotes ?? 0n, "recommendation downvotes"),
			replies: toSafeInteger(row.replies ?? 0n, "recommendation replies"),
			favorites: toSafeInteger(row.favorites ?? 0n, "recommendation favorites"),
			shares: toSafeInteger(row.shares ?? 0n, "recommendation shares"),
			highScores: toSafeInteger(row.highScores ?? 0n, "recommendation high scores"),
			activeProgress: toSafeInteger(
				row.activeProgress ?? 0n,
				"recommendation active progress",
			),
			completions: toSafeInteger(row.completions ?? 0n, "recommendation completions"),
			negativeProgress: toSafeInteger(
				row.negativeProgress ?? 0n,
				"recommendation negative progress",
			),
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
	const rankedByScore = rankRecommendations(candidates, {
		sort: "best",
		personalized: input.viewer.personalized || Boolean(input.seedUnitId),
		asOf: input.asOf,
		pageSize: input.pageSize,
	});
	const directIds = new Set(directSeedRows.map(({ id }) => id));
	const inheritedIds = new Set(inheritedSeedRows.map(({ id }) => id));
	const provenanceRank = (id: string) => (directIds.has(id) ? 0 : inheritedIds.has(id) ? 1 : 2);
	const ranked = input.seedUnitId
		? [...rankedByScore].sort(
				(left, right) => provenanceRank(left.id) - provenanceRank(right.id),
			)
		: rankedByScore;
	const start = input.afterId ? ranked.findIndex(({ id }) => id === input.afterId) + 1 : 0;
	if (input.afterId && start === 0) return null;
	const page = ranked.slice(start, start + input.pageSize);
	const pageIds = page.map(({ id }) => id);
	const [details, localizations] = await Promise.all([
		database
			.select({
				id: unit.id,
				kind: unit.kind,
				contentRating: unit.contentRating,
				publishedAt: unit.publishedAt,
				createdAt: unit.createdAt,
				updatedAt: unit.updatedAt,
				coverAssetId: resolvedUnitLocalizationImageAssetId(
					unit.id,
					"cover",
					input.localizationLanguages,
				),
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
				input.localizationLanguages,
			);
			return [
				(async () => ({
					id: detail.id,
					type: kind,
					language: localization?.language ?? null,
					contentRating: detail.contentRating,
					publishedAt: detail.publishedAt,
					createdAt: detail.createdAt,
					updatedAt: detail.updatedAt,
					title: localization?.title ?? null,
					summary: localization?.summary ?? null,
					cover: presentImageAsset(detail.coverAssetId, "cover"),
					recommendationReason: reasons.get(detail.id) ?? null,
					source: input.seedUnitId
						? directIds.has(detail.id)
							? ("direct" as const)
							: inheritedIds.has(detail.id)
								? ("main" as const)
								: null
						: null,
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

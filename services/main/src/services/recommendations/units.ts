import { and, eq, exists, inArray, isNull, lte, not, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import type { RecommendationReason, RecommendationSurface } from "../api/recommendations/schema";
import { contentRatingPolicyFromAllowlist } from "../content-rating/policy";
import { database } from "../database";
import { unit, unitBestScore, unitLocalization, unitVariant } from "../database/schema";
import { compareFractionalPositions } from "../ordering/position";
import { searchGlobalIdentifiers } from "../search/service";
import { resolvedUnitLocalizationImageAssetId } from "../units/localization";
import { presentImageAsset } from "../units/service";
import type { RecommendationSnapshotContext, RecommendationViewer } from "./context";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";
import { rankRecommendations, type RecommendationCandidate } from "./ranking";
import { createRecommendationTracking } from "./tracking";

export type RecommendedUnitKind = "book" | "software" | "media";

interface UnitCandidate extends RecommendationCandidate {
	readonly kind: RecommendedUnitKind;
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
		inArray(unit.contentRating, input.viewer.contentRatings),
		input.viewer.profileId
			? sql`(${unit.id} = ${input.afterId ?? null}::uuid or not exists (
				select 1 from recommendation_exclusion excluded
				where excluded.profile_id = ${input.viewer.profileId}::uuid
					and excluded.unit_id = ${unit.id}
			))`
			: undefined,
	);
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
	const kinds: readonly RecommendedUnitKind[] = input.type
		? [input.type]
		: ["book", "software", "media"];
	const selected = await searchGlobalIdentifiers({
		branches: [
			{
				category: "units",
				searchExpression:
					kinds.length === 1
						? { field: "kind", operator: "equals", value: kinds[0]! }
						: { field: "kind", operator: "any-of", values: [...kinds] },
				sourceUnitKinds: kinds,
			},
		],
		kinds: [...kinds],
		contentRatings: [...input.viewer.contentRatings],
		contentRatingPolicy: contentRatingPolicyFromAllowlist(input.viewer.contentRatings),
		...(input.viewer.profileId ? { profileId: input.viewer.profileId } : {}),
		limit: RecommendationPolicy.maxCandidates,
		sort: "best",
	});
	const seedUnitIds = [input.seedUnitId, input.inheritedSeedUnitId].filter(
		(value): value is string => Boolean(value),
	);
	const condition = eligibleUnit({ ...input, seedUnitIds });
	const snapshotJoin = input.snapshot?.id
		? and(eq(unitBestScore.snapshotId, input.snapshot.id), eq(unitBestScore.unitId, unit.id))
		: sql`false`;
	const rows = selected.hits.length
		? await database
				.select({
					id: unit.id,
					kind: unit.kind,
					createdAt: unit.createdAt,
					updatedAt: unit.updatedAt,
					bestScore: sql<number>`coalesce(${unitBestScore.score}, 0)`,
				})
				.from(unit)
				.leftJoin(unitBestScore, snapshotJoin)
				.where(
					and(
						inArray(
							unit.id,
							selected.hits.map(({ id }) => id),
						),
						condition,
					),
				)
		: [];
	const candidates = rows.flatMap((row): UnitCandidate[] =>
		row.kind === "book" || row.kind === "software" || row.kind === "media"
			? [{ ...row, kind: row.kind }]
			: [],
	);
	const ranked = rankRecommendations(candidates, { sort: "best" });
	const start = input.afterId ? ranked.findIndex(({ id }) => id === input.afterId) + 1 : 0;
	if (input.afterId && start === 0) return null;
	const page = ranked.slice(start, start + input.pageSize);
	const pageIds = page.map(({ id }) => id);
	if (!pageIds.length) return { items: [], nextId: undefined };
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
	const scoreById = new Map(page.map(({ id, bestScore }) => [id, bestScore]));
	const items = page.flatMap((rankedItem, index) => {
		const detail = detailById.get(rankedItem.id);
		if (
			!detail ||
			(detail.kind !== "book" && detail.kind !== "software" && detail.kind !== "media")
		)
			return [];
		const localization = selectLocalization(
			localizationById.get(detail.id) ?? [],
			input.localizationLanguages,
		);
		const recommendationReason: RecommendationReason =
			(scoreById.get(detail.id) ?? 0) > 0 ? "popular_now" : "new_and_relevant";
		return [
			{
				id: detail.id,
				type: detail.kind,
				language: localization?.language ?? null,
				contentRating: detail.contentRating,
				publishedAt: detail.publishedAt,
				createdAt: detail.createdAt,
				updatedAt: detail.updatedAt,
				title: localization?.title ?? null,
				summary: localization?.summary ?? null,
				cover: presentImageAsset(detail.coverAssetId, "cover"),
				recommendationReason,
				source: null,
				tracking: createRecommendationTracking(detail.id, {
					requestId: input.requestId,
					surface: surface(detail.kind, Boolean(input.seedUnitId)),
					position: start + index,
					policyVersion: input.snapshot?.policyVersion ?? RecommendationPolicyVersion,
				}),
			},
		];
	});
	return {
		items,
		nextId: start + page.length < ranked.length ? page.at(-1)?.id : undefined,
	};
}

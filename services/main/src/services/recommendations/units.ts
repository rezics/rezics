import { recommendationExclusionCondition } from "./exclusion-query";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { CatalogOwnerValues, CatalogOwnerSchema, type CatalogOwner } from "@rezics/reference";
import type { ContentLanguage } from "@rezics/i18n";
import type { RecommendationReason } from "../api/recommendations/schema";
import { contentRatingPolicyFromAllowlist } from "../content-rating/policy";
import { database } from "../database";
import { unitBestScore } from "../database/schema";
import { searchGlobalIdentifiers } from "../search/service";
import { unitStateRelation, unitStatesForIds } from "../units/state-relation";
import { readUnitPresentationsInTransaction } from "../units/presentation-reader";
import type { RecommendationSnapshotContext, RecommendationViewer } from "./context";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";
import { rankRecommendations } from "./ranking";
import { createRecommendationTracking } from "./tracking";

export async function recommendUnits(input: {
	viewer: RecommendationViewer;
	snapshot: RecommendationSnapshotContext | null;
	owner?: CatalogOwner;
	shape?: string;
	seedUnitId?: string;
	asOf: Date;
	pageSize: number;
	localizationLanguages: readonly ContentLanguage[];
	afterId?: string;
	requestId: string;
}) {
	const owners = input.owner ? [input.owner] : [...CatalogOwnerValues];
	const target = unitStateRelation(sql`null::uuid`, "search_unit");
	const eligible = and(
		eq(target.status, "published"),
		eq(target.visibility, "public"),
		eq(target.moderationStatus, "approved"),
		isNull(target.deletedAt),
		lte(target.createdAt, input.asOf),
		lte(target.updatedAt, input.asOf),
		inArray(target.contentRating, [...input.viewer.contentRatings]),
		input.seedUnitId ? sql`${target.id} <> ${input.seedUnitId}::uuid` : undefined,
		// Keep the exclusion as an anti-join; an OR around EXISTS can trigger expensive JIT compilation.
		input.viewer.authUserId
			? sql`not ${recommendationExclusionCondition(input.afterId ? sql`nullif(${target.id},${input.afterId}::uuid)` : target.id, input.viewer.authUserId)}`
			: undefined,
	)!;
	const selected = await searchGlobalIdentifiers({
		branches: [
			...(owners.includes("entity")
				? [
						{
							category: "entities" as const,
							sourceOwners: ["entity" as const],
							sourceShapes: input.shape ? [input.shape] : [],
						},
					]
				: []),
			...(owners.some((owner) => owner !== "entity")
				? [
						{
							category: "units" as const,
							sourceOwners: owners.filter((owner) => owner !== "entity"),
							sourceShapes: input.shape ? [input.shape] : [],
						},
					]
				: []),
		],
		contentRatings: [...input.viewer.contentRatings],
		contentRatingPolicy: contentRatingPolicyFromAllowlist(input.viewer.contentRatings),
		...(input.viewer.profileId ? { profileId: input.viewer.profileId } : {}),
		additionalConditions: [eligible],
		limit: RecommendationPolicy.maxCandidates,
		sort: "best",
		bestSnapshotId: input.snapshot?.id ?? null,
	});
	if (!selected.hits.length) return input.afterId ? null : { items: [], nextId: undefined };
	const ids = selected.hits.map((hit) => hit.id);
	return database.transaction(
		async (tx) => {
			const rows = await tx
				.select({
					id: target.id,
					owner: target.owner,
					shape: target.shape,
					contentRating: target.contentRating,
					createdAt: target.createdAt,
					updatedAt: target.updatedAt,
					publishedAt: target.publishedAt,
					bestScore: sql<number>`coalesce(${unitBestScore.score},0)`,
				})
				.from(unitStatesForIds(ids, "search_unit"))
				.leftJoin(
					unitBestScore,
					input.snapshot
						? and(
								eq(unitBestScore.snapshotId, input.snapshot.id),
								eq(unitBestScore.unitId, target.id),
							)
						: sql`false`,
				)
				.where(eligible);
			const ranked = rankRecommendations(
				rows.flatMap((row) => {
					const parsed = CatalogOwnerSchema.safeParse(row.owner);
					return parsed.success ? [{ ...row, owner: parsed.data }] : [];
				}),
				{ sort: "best" },
			);
			const start = input.afterId ? ranked.findIndex((row) => row.id === input.afterId) + 1 : 0;
			if (input.afterId && start === 0) return null;
			const page = ranked.slice(start, start + input.pageSize);
			const presentations = await readUnitPresentationsInTransaction(
				tx,
				page.map((row) => row.id),
				input.localizationLanguages,
				{ includeCover: true },
			);
			const items = page.flatMap((row, index) => {
				const presentation = presentations.get(row.id);
				if (!presentation) return [];
				const recommendationReason: RecommendationReason =
					row.bestScore > 0 ? "popular_now" : "new_and_relevant";
				return [
					{
						...row,
						language: presentation.language,
						title: presentation.title,
						summary: presentation.summary,
						cover: presentation.cover ?? null,
						recommendationReason,
						tracking: createRecommendationTracking(row.id, {
							requestId: input.requestId,
							surface: input.seedUnitId ? "unit_related" : "home_catalog",
							position: start + index,
							policyVersion: input.snapshot?.policyVersion ?? RecommendationPolicyVersion,
						}),
					},
				];
			});
			return { items, nextId: start + page.length < ranked.length ? page.at(-1)?.id : undefined };
		},
		{ isolationLevel: "repeatable read", accessMode: "read only" },
	);
}

import { and, count, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import { assertPlatformCoreReady, inspectPlatformCore } from "../bootstrap/core";
import {
	BootstrapUnitIds,
	CuratedCreationTagCollectionManifest,
	OfficialZoneManifest,
} from "../bootstrap/data";
import { database } from "../database";
import {
	contentReviewCase,
	notification,
	apiTokenQuotaOverride,
	collectionItem,
	platformCapabilityGrant,
	postScore,
	profile,
	profileRealmTagSubscription,
	profileUnitTag,
	recommendationSnapshot,
	realmScoreContext,
	realmTagContext,
	realmTagJudgment,
	realmUnitTag,
	release,
	sharedSearchQuery,
	subjectAssociation,
	unit,
	unitAccessGrant,
	unitAccessInvitation,
	unitAccessRestriction,
	unitAssociationProposal,
	unitLocalization,
	unitLocalizationContentMetric,
	unitStructure,
	users,
} from "../database/schema";
import { includesSeedScenario, type SeedRunOptions } from "./contracts";
import { DemoCredentials, SeedFixtureTitles } from "./data";
import { executeSearchFeatureInput } from "../search/filter-document";

export interface SeedVerificationResult {
	readonly profile: SeedRunOptions["profile"];
	readonly seededUnits: number;
	readonly activeRecommendationSnapshots: number;
	readonly missingContentMetrics: number;
}

function requireZero(value: number, message: string): void {
	if (value !== 0) throw new Error(`${message}: ${value}`);
}

function requirePositive(value: number, message: string): void {
	if (value < 1) throw new Error(message);
}

/** Verifies observable postconditions after Seed-derived projections are built. */
export async function verifySeedDatabase(
	options: Pick<SeedRunOptions, "profile" | "scenarios">,
): Promise<SeedVerificationResult> {
	assertPlatformCoreReady(await inspectPlatformCore());
	const coverageContractQueries = [
		{
			name: "Shared Search query",
			query: database.select({ value: count() }).from(sharedSearchQuery),
		},
		{
			name: "API token quota override",
			query: database.select({ value: count() }).from(apiTokenQuotaOverride),
		},
		{
			name: "Unit access invitation",
			query: database.select({ value: count() }).from(unitAccessInvitation),
		},
		{
			name: "Unit access restriction",
			query: database.select({ value: count() }).from(unitAccessRestriction),
		},
		{
			name: "Entity association access grant",
			query: database
				.select({ value: count() })
				.from(unitAccessGrant)
				.where(
					inArray(unitAccessGrant.permission, [
						"entity.association.credit.request",
						"entity.association.credit.direct",
						"entity.association.subject.request",
						"entity.association.subject.direct",
					]),
				),
		},
		{
			name: "Unit association proposal",
			query: database.select({ value: count() }).from(unitAssociationProposal),
		},
		{
			name: "Subject association",
			query: database.select({ value: count() }).from(subjectAssociation),
		},
		{
			name: "Profile Realm Tag subscription",
			query: database.select({ value: count() }).from(profileRealmTagSubscription),
		},
		{
			name: "Profile Unit Tag",
			query: database.select({ value: count() }).from(profileUnitTag),
		},
		{
			name: "Realm Unit Tag",
			query: database.select({ value: count() }).from(realmUnitTag),
		},
		{
			name: "Realm Tag context",
			query: database.select({ value: count() }).from(realmTagContext),
		},
		{
			name: "Realm Tag vote",
			query: database.select({ value: count() }).from(realmTagJudgment),
		},
		{
			name: "Tag structure",
			query: database.select({ value: count() }).from(unitStructure),
		},
		{
			name: "Post Score",
			query: database.select({ value: count() }).from(postScore),
		},
		{
			name: "Realm Score context",
			query: database.select({ value: count() }).from(realmScoreContext),
		},
		{
			name: "Release",
			query: database.select({ value: count() }).from(release),
		},
	] as const;
	const [
		seededUnitsResult,
		demoUsers,
		missingContentMetricsResult,
		activeSnapshotsResult,
		officialZoneFixtures,
		curatedTagCollectionItems,
		coverageContractResults,
		notificationsResult,
		contentReviewCasesResult,
		demoPlatformGrantResult,
	] = await Promise.all([
		database
			.select({ value: count() })
			.from(unit)
			.where(notInArray(unit.id, [...BootstrapUnitIds])),
		database
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, DemoCredentials.email))
			.limit(1),
		database
			.select({ value: count() })
			.from(unitLocalization)
			.leftJoin(
				unitLocalizationContentMetric,
				and(
					eq(unitLocalizationContentMetric.unitId, unitLocalization.unitId),
					eq(unitLocalizationContentMetric.language, unitLocalization.language),
				),
			)
			.where(
				and(
					isNotNull(unitLocalization.content),
					sql`${unitLocalization.content}->>'_type' = 'portable-text'`,
					isNull(unitLocalizationContentMetric.unitId),
				),
			),
		database
			.select({ value: count() })
			.from(recommendationSnapshot)
			.where(
				and(
					eq(recommendationSnapshot.active, true),
					eq(recommendationSnapshot.state, "ready"),
					isNotNull(recommendationSnapshot.completedAt),
				),
			),
		database
			.select({ kind: unit.kind, title: unitLocalization.title })
			.from(unitLocalization)
			.innerJoin(unit, eq(unit.id, unitLocalization.unitId))
			.where(
				inArray(unitLocalization.title, [
					SeedFixtureTitles.book.en,
					SeedFixtureTitles.media.en,
					SeedFixtureTitles.software.en,
				]),
			),
		database
			.select({ collectionId: collectionItem.collectionId, value: count() })
			.from(collectionItem)
			.where(
				inArray(
					collectionItem.collectionId,
					CuratedCreationTagCollectionManifest.map((value) => value.id),
				),
			)
			.groupBy(collectionItem.collectionId),
		Promise.all(
			coverageContractQueries.map(async ({ name, query }) => ({
				name,
				value: (await query)[0]?.value ?? 0,
			})),
		),
		database.select({ value: count() }).from(notification),
		database.select({ value: count() }).from(contentReviewCase),
		database
			.select({ value: count() })
			.from(platformCapabilityGrant)
			.innerJoin(profile, eq(platformCapabilityGrant.profileId, profile.id))
			.innerJoin(users, eq(profile.authUserId, users.id))
			.where(eq(users.email, DemoCredentials.email)),
	]);
	const seededUnits = seededUnitsResult[0]?.value ?? 0;
	const missingContentMetrics = missingContentMetricsResult[0]?.value ?? 0;
	const activeRecommendationSnapshots = activeSnapshotsResult[0]?.value ?? 0;
	requirePositive(seededUnits, "Seed service produced no non-Bootstrap Units");
	requirePositive(demoUsers.length, "Seed service did not create the demo identity");
	requireZero(
		demoPlatformGrantResult[0]?.value ?? 0,
		"Seed demo identity must not receive platform capability grants",
	);
	for (const [kind, fixture] of [
		["book", SeedFixtureTitles.book],
		["media", SeedFixtureTitles.media],
		["software", SeedFixtureTitles.software],
	] as const)
		if (!officialZoneFixtures.some((row) => row.kind === kind && row.title === fixture.en))
			throw new Error(`Seed service did not create the official ${kind} search fixture`);
	for (const expected of CuratedCreationTagCollectionManifest)
		requirePositive(
			curatedTagCollectionItems.find((row) => row.collectionId === expected.id)?.value ?? 0,
			`Seed service did not populate curated Tag Collection ${expected.key}`,
		);
	for (const result of coverageContractResults)
		requirePositive(result.value, `${result.name} feature-contract scenario produced no rows`);
	requireZero(missingContentMetrics, "Seed content is missing derived localization metrics");
	if (activeRecommendationSnapshots !== 1)
		throw new Error(
			`Seed service requires exactly one active ready recommendation snapshot; received ${activeRecommendationSnapshots}`,
		);
	if (includesSeedScenario(options, "communications"))
		requirePositive(
			notificationsResult[0]?.value ?? 0,
			"Communications scenario produced no notifications",
		);
	if (includesSeedScenario(options, "governance"))
		requirePositive(
			contentReviewCasesResult[0]?.value ?? 0,
			"Governance scenario produced no content review cases",
		);
	return {
		profile: options.profile,
		seededUnits,
		activeRecommendationSnapshots,
		missingContentMetrics,
	};
}

/** Verifies current authoritative PostgreSQL Search against the official Zone fixtures. */
export async function verifySeedSearch(): Promise<void> {
	for (const officialZone of OfficialZoneManifest) {
		const fixture = SeedFixtureTitles[officialZone.slug];
		const response = await executeSearchFeatureInput(
			{
				filterDocument: officialZone.filterDocument,
				contexts: [{ kind: "zone", zoneId: officialZone.id }],
				injections: [],
				state: {
					filter: { search: { query: fixture.en } },
					pageSize: 5,
				},
			},
			{ sortProfile: "search", pageBudget: "per-category" },
			["en"],
			undefined,
			true,
		);
		const hits = response.groups.flatMap((group) => group.hits);
		if (!hits.some((hit) => hit.titles.includes(fixture.en)))
			throw new Error(
				`Authoritative Search did not return the official ${officialZone.slug} fixture`,
			);
	}
}

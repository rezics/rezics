import { and, count, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import { databaseBootstrapService } from "../bootstrap/service";
import { BootstrapUnitIds, OfficialZoneManifest } from "../bootstrap/manifest";
import { database } from "../database";
import {
	moderationCase,
	notification,
	apiTokenPolicyBinding,
	entityAssociationPolicy,
	postScore,
	profileRealmTagSubscription,
	profileUnitTag,
	recommendationSnapshot,
	realmScoreContext,
	realmTagContext,
	realmTagVote,
	realmUnitTag,
	release,
	sharedSearchQuery,
	subjectAssociation,
	unit,
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
import { createDefaultSearchDocument, executeSearchFeatureInput } from "../search/templates";

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
	if (!(await databaseBootstrapService.isReady()))
		throw new Error("Seed verification requires a ready independent Bootstrap service");
	const coverageContractQueries = [
		{
			name: "Shared Search query",
			query: database.select({ value: count() }).from(sharedSearchQuery),
		},
		{
			name: "API token policy binding",
			query: database.select({ value: count() }).from(apiTokenPolicyBinding),
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
			name: "Entity association policy",
			query: database.select({ value: count() }).from(entityAssociationPolicy),
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
			query: database.select({ value: count() }).from(realmTagVote),
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
		coverageContractResults,
		notificationsResult,
		moderationCasesResult,
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
		Promise.all(
			coverageContractQueries.map(async ({ name, query }) => ({
				name,
				value: (await query)[0]?.value ?? 0,
			})),
		),
		database.select({ value: count() }).from(notification),
		database.select({ value: count() }).from(moderationCase),
	]);
	const seededUnits = seededUnitsResult[0]?.value ?? 0;
	const missingContentMetrics = missingContentMetricsResult[0]?.value ?? 0;
	const activeRecommendationSnapshots = activeSnapshotsResult[0]?.value ?? 0;
	requirePositive(seededUnits, "Seed service produced no non-Bootstrap Units");
	requirePositive(demoUsers.length, "Seed service did not create the demo identity");
	for (const [kind, fixture] of [
		["book", SeedFixtureTitles.book],
		["media", SeedFixtureTitles.media],
		["software", SeedFixtureTitles.software],
	] as const)
		if (!officialZoneFixtures.some((row) => row.kind === kind && row.title === fixture.en))
			throw new Error(`Seed service did not create the official ${kind} search fixture`);
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
			moderationCasesResult[0]?.value ?? 0,
			"Governance scenario produced no moderation cases",
		);
	return {
		profile: options.profile,
		seededUnits,
		activeRecommendationSnapshots,
		missingContentMetrics,
	};
}

/** Verifies the promoted external Search projection after a coordinated rebuild. */
export async function verifySeedSearch(): Promise<void> {
	for (const officialZone of OfficialZoneManifest) {
		const fixture = SeedFixtureTitles[officialZone.searchTemplate];
		const response = await executeSearchFeatureInput({
			document: createDefaultSearchDocument(officialZone.searchTemplate),
			contexts: [{ kind: "zone", zoneId: officialZone.id }],
			injections: [],
			state: {
				mode: "basic",
				query: fixture.en,
				values: [],
				pageSize: 5,
			},
		});
		const hits = response.groups.flatMap((group) => group.hits);
		if (!hits.some((hit) => hit.titles.includes(fixture.en)))
			throw new Error(
				`Promoted Search projection did not return the official ${officialZone.searchTemplate} fixture`,
			);
	}
}

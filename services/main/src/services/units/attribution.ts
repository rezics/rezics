import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import { database, type DatabaseExecutor } from "../database";
import { creditAttribution, unit, unitFollowStat } from "../database/schema";
import { toSafeInteger } from "../database/integer";
import type { CreditAttributionRole, UnitKind } from "../database/schema/contract-values";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "./localization";
import {
	getPublicCanonicalUnitSlugAddresses,
	type PublicCanonicalUnitSlugAddress,
} from "./slug-address";
import { presentAvatar } from "./avatar";
import type { PresentedAvatar } from "@rezics/avatar";
import { getUnitReadCondition } from "../authorization/unit/query";
import { exactCount, lowerBoundCount, type CountResult } from "../counts/contract";
import { WorkPolicy } from "../performance/policy";

export const PublisherAttributionRole = "publisher" as const;

export type UnitAttributionSummary = {
	readonly id: string;
	readonly role: CreditAttributionRole;
	readonly position: string;
	readonly creditedUnit: {
		readonly id: string;
		readonly kind: UnitKind;
		readonly language: ContentLanguage;
		readonly slugAddress: PublicCanonicalUnitSlugAddress | null;
		readonly title: string | null;
		readonly summary: string | null;
		readonly avatar: PresentedAvatar | null;
	};
};

export type UnitSummary = UnitAttributionSummary["creditedUnit"];

export type UnitPresentation = Pick<
	UnitSummary,
	"id" | "kind" | "language" | "title" | "summary" | "avatar"
>;

export type UnitAttributionSummaryWithStatistics = Omit<UnitAttributionSummary, "creditedUnit"> & {
	readonly creditedUnit: UnitSummary & {
		readonly creditedBookCount: CountResult;
		readonly followerCount: number;
	};
};

export async function getPublicUnitSummariesByIds(
	unitIds: readonly string[],
	localizationLanguages: LocalizationLanguageQuery = [],
): Promise<Map<string, UnitSummary>> {
	if (!unitIds.length) return new Map();
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(unit.id, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(unit.id, localizationLanguages),
		})
		.from(unit)
		.where(
			and(
				inArray(unit.id, [...unitIds]),
				eq(unit.status, "published"),
				ne(unit.visibility, "private"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		);
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(rows.map(({ id }) => id));
	return new Map(
		rows.flatMap(({ avatar, ...row }) =>
			row.language
				? [
						[
							row.id,
							{
								...row,
								language: row.language,
								slugAddress: slugAddresses.get(row.id) ?? null,
								avatar: presentAvatar(avatar),
							},
						] as const,
					]
				: [],
		),
	);
}

/** Resolve a locale-aware presentation for every Unit readable by the current viewer. */
export async function getReadableUnitPresentationsByIds(input: {
	readonly unitIds: readonly string[];
	readonly localizationLanguages: LocalizationLanguageQuery;
	readonly profileId?: string;
}): Promise<Map<string, UnitPresentation>> {
	const { unitIds, localizationLanguages, profileId } = input;
	if (!unitIds.length) return new Map();
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(unit.id, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(unit.id, localizationLanguages),
		})
		.from(unit)
		.where(and(inArray(unit.id, [...unitIds]), getUnitReadCondition(profileId)));
	return new Map(
		rows.flatMap(({ avatar, ...row }) =>
			row.language
				? [
						[
							row.id,
							{
								...row,
								language: row.language,
								avatar: presentAvatar(avatar),
							},
						] as const,
					]
				: [],
		),
	);
}

async function getAttributionStatisticsByUnitIds(
	unitIds: readonly string[],
): Promise<
	Map<string, { readonly creditedBookCount: CountResult; readonly followerCount: number }>
> {
	if (!unitIds.length) return new Map();
	type CreditedBookRow = { readonly creditedUnitId: string; readonly sourceUnitId: string };
	const creditedUnitArray = sql`array[${sql.join(
		[...new Set(unitIds)].map((unitId) => sql`${unitId}::uuid`),
		sql`, `,
	)}]::uuid[]`;
	const [followerRows, creditedBookRows] = await Promise.all([
		database
			.select({
				unitId: unitFollowStat.unitId,
				followerCount: unitFollowStat.followerCount,
			})
			.from(unitFollowStat)
			.where(inArray(unitFollowStat.unitId, [...unitIds])),
		database.execute<CreditedBookRow>(sql`
			select requested.credited_unit_id as "creditedUnitId",
				bounded.source_unit_id as "sourceUnitId"
			from unnest(${creditedUnitArray}) as requested(credited_unit_id)
			cross join lateral (
				select distinct attribution.source_unit_id
				from ${creditAttribution} as attribution
				inner join ${unit} as source_unit on source_unit.id = attribution.source_unit_id
				where attribution.credited_unit_id = requested.credited_unit_id
					and attribution.role in ('author', 'co-author')
					and source_unit.kind = 'book'
					and source_unit.status = 'published'
					and source_unit.visibility <> 'private'
					and source_unit.moderation_status = 'approved'
					and source_unit.deleted_at is null
				order by attribution.source_unit_id
				limit ${WorkPolicy.count.maxCreditedBookCountScan}
			) as bounded
		`),
	]);
	const followerCounts = new Map(
		followerRows.map(({ unitId, followerCount }) => [
			unitId,
			toSafeInteger(followerCount, "Unit follower count"),
		]),
	);
	const creditedBookValues = new Map<string, number>();
	for (const { creditedUnitId } of creditedBookRows.rows)
		creditedBookValues.set(creditedUnitId, (creditedBookValues.get(creditedUnitId) ?? 0) + 1);
	const creditedBookCount = (unitId: string): CountResult => {
		const value = creditedBookValues.get(unitId) ?? 0;
		return value < WorkPolicy.count.maxCreditedBookCountScan
			? exactCount(value)
			: lowerBoundCount(value);
	};
	return new Map(
		unitIds.map((unitId) => [
			unitId,
			{
				creditedBookCount: creditedBookCount(unitId),
				followerCount: followerCounts.get(unitId) ?? 0,
			},
		]),
	);
}

/**
 * Records the public identity shown as the publisher of a newly created Post.
 * Access ownership is created separately; neither relationship implies the other.
 */
export async function createProfilePublisherAttribution(
	executor: DatabaseExecutor,
	input: { readonly sourceUnitId: string; readonly profileId: string },
): Promise<void> {
	await executor
		.insert(creditAttribution)
		.values({
			sourceUnitId: input.sourceUnitId,
			creditedUnitId: input.profileId,
			role: PublisherAttributionRole,
		})
		.onConflictDoNothing();
}

export async function getAttributionSummariesByUnitIds(
	sourceUnitIds: readonly string[],
	localizationLanguages: LocalizationLanguageQuery = [],
): Promise<Map<string, UnitAttributionSummary[]>> {
	const result = new Map<string, UnitAttributionSummary[]>();
	for (const sourceUnitId of sourceUnitIds) result.set(sourceUnitId, []);
	if (!sourceUnitIds.length) return result;

	const rows = await database
		.select({
			sourceUnitId: creditAttribution.sourceUnitId,
			id: creditAttribution.id,
			role: creditAttribution.role,
			position: creditAttribution.position,
			creditedUnitId: creditAttribution.creditedUnitId,
		})
		.from(creditAttribution)
		.where(inArray(creditAttribution.sourceUnitId, [...sourceUnitIds]))
		.orderBy(
			asc(creditAttribution.sourceUnitId),
			asc(creditAttribution.position),
			asc(creditAttribution.id),
		);
	const creditedUnits = await getPublicUnitSummariesByIds(
		rows.map(({ creditedUnitId }) => creditedUnitId),
		localizationLanguages,
	);
	for (const row of rows) {
		const creditedUnit = creditedUnits.get(row.creditedUnitId);
		if (!creditedUnit) continue;
		result.get(row.sourceUnitId)?.push({
			id: row.id,
			role: row.role,
			position: row.position,
			creditedUnit,
		});
	}
	return result;
}

export async function getAttributionSummariesWithStatisticsByUnitIds(
	sourceUnitIds: readonly string[],
	localizationLanguages: LocalizationLanguageQuery = [],
): Promise<Map<string, UnitAttributionSummaryWithStatistics[]>> {
	const summaries = await getAttributionSummariesByUnitIds(sourceUnitIds, localizationLanguages);
	const statistics = await getAttributionStatisticsByUnitIds(
		[...summaries.values()].flatMap((items) => items.map(({ creditedUnit }) => creditedUnit.id)),
	);
	return new Map(
		[...summaries].map(([sourceUnitId, items]) => [
			sourceUnitId,
			items.map((item) => ({
				...item,
				creditedUnit: {
					...item.creditedUnit,
					...(statistics.get(item.creditedUnit.id) ?? {
						creditedBookCount: exactCount(0),
						followerCount: 0,
					}),
				},
			})),
		]),
	);
}

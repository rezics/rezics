import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import { database, type DatabaseExecutor } from "../database";
import { creditAttribution, unit, unitFollowStat } from "../database/schema";
import { toSafeInteger } from "../database/integer";
import type { CreditAttributionRole, UnitKind } from "../database/schema/contract-values";
import {
	firstUnitLocalizationTitle,
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

export type UnitMentionPresentation = Pick<UnitSummary, "id" | "kind" | "title" | "avatar">;

export type UnitAttributionSummaryWithStatistics = Omit<UnitAttributionSummary, "creditedUnit"> & {
	readonly creditedUnit: UnitSummary & {
		readonly creditedBookCount: number;
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

/** Resolve mention presentation for every Unit readable by the current viewer. */
export async function getReadableUnitPresentationsByIds(
	unitIds: readonly string[],
	profileId?: string,
): Promise<Map<string, UnitMentionPresentation>> {
	if (!unitIds.length) return new Map();
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			title: firstUnitLocalizationTitle(unit.id),
			avatar: resolvedUnitLocalizationAvatar(unit.id),
		})
		.from(unit)
		.where(and(inArray(unit.id, [...unitIds]), getUnitReadCondition(profileId)));
	return new Map(
		rows.map(({ avatar, ...row }) => [
			row.id,
			{
				...row,
				avatar: presentAvatar(avatar),
			},
		]),
	);
}

async function getAttributionStatisticsByUnitIds(
	unitIds: readonly string[],
): Promise<Map<string, { readonly creditedBookCount: number; readonly followerCount: number }>> {
	if (!unitIds.length) return new Map();
	const [followerRows, creditedBookRows] = await Promise.all([
		database
			.select({
				unitId: unitFollowStat.unitId,
				followerCount: unitFollowStat.followerCount,
			})
			.from(unitFollowStat)
			.where(inArray(unitFollowStat.unitId, [...unitIds])),
		database
			.select({
				creditedUnitId: creditAttribution.creditedUnitId,
				creditedBookCount: sql<unknown>`count(distinct ${creditAttribution.sourceUnitId})`,
			})
			.from(creditAttribution)
			.innerJoin(unit, eq(unit.id, creditAttribution.sourceUnitId))
			.where(
				and(
					inArray(creditAttribution.creditedUnitId, [...unitIds]),
					inArray(creditAttribution.role, ["author", "co-author"]),
					eq(unit.kind, "book"),
					eq(unit.status, "published"),
					ne(unit.visibility, "private"),
					eq(unit.moderationStatus, "approved"),
					isNull(unit.deletedAt),
				),
			)
			.groupBy(creditAttribution.creditedUnitId),
	]);
	const followerCounts = new Map(
		followerRows.map(({ unitId, followerCount }) => [
			unitId,
			toSafeInteger(followerCount, "Unit follower count"),
		]),
	);
	const creditedBookCounts = new Map(
		creditedBookRows.map(({ creditedUnitId, creditedBookCount }) => [
			creditedUnitId,
			toSafeInteger(creditedBookCount, "credited Book count"),
		]),
	);
	return new Map(
		unitIds.map((unitId) => [
			unitId,
			{
				creditedBookCount: creditedBookCounts.get(unitId) ?? 0,
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
		[...summaries.values()].flatMap((items) =>
			items.map(({ creditedUnit }) => creditedUnit.id),
		),
	);
	return new Map(
		[...summaries].map(([sourceUnitId, items]) => [
			sourceUnitId,
			items.map((item) => ({
				...item,
				creditedUnit: {
					...item.creditedUnit,
					...(statistics.get(item.creditedUnit.id) ?? {
						creditedBookCount: 0,
						followerCount: 0,
					}),
				},
			})),
		]),
	);
}

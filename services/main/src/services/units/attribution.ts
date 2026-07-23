import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import { database, type DatabaseExecutor } from "../database";
import { creditAttribution, unit } from "../database/schema";
import type { CreditAttributionRole, UnitKind } from "../database/schema/contract-values";
import {
	primaryUnitSummary,
	primaryUnitTitle,
	resolvedUnitLocalizationAvatar,
} from "./localization";
import {
	getPublicCanonicalUnitSlugAddresses,
	type PublicCanonicalUnitSlugAddress,
} from "./slug-address";
import { presentAvatar } from "./avatar";
import type { PresentedAvatar } from "@rezics/avatar";

export const PublisherAttributionRole = "publisher" as const;

export type UnitAttributionSummary = {
	readonly id: string;
	readonly role: CreditAttributionRole;
	readonly position: string;
	readonly creditedUnit: {
		readonly id: string;
		readonly kind: UnitKind;
		readonly slugAddress: PublicCanonicalUnitSlugAddress | null;
		readonly title: string | null;
		readonly summary: string | null;
		readonly avatar: PresentedAvatar | null;
	};
};

export type UnitSummary = UnitAttributionSummary["creditedUnit"];

export async function getPublicUnitSummariesByIds(
	unitIds: readonly string[],
): Promise<Map<string, UnitSummary>> {
	if (!unitIds.length) return new Map();
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			title: primaryUnitTitle(unit.id),
			summary: primaryUnitSummary(unit.id),
			avatar: resolvedUnitLocalizationAvatar(unit.id),
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
		rows.map(({ avatar, ...row }) => [
			row.id,
			{
				...row,
				slugAddress: slugAddresses.get(row.id) ?? null,
				avatar: presentAvatar(avatar),
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

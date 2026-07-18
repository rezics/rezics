import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { unitLocalization } from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";

/** Return the first position in the Unit's ordered localization sequence. */
function primaryUnitLocalizationPosition(unitId: SQLWrapper): SQL<string | null> {
	return sql<string | null>`(
		select "primary_localization"."position"
		from "unit_localization" as "primary_localization"
		where "primary_localization"."unit_id" = ${unitId}
		order by "primary_localization"."position", "primary_localization"."language"
		limit 1
	)`;
}

export function isPrimaryUnitLocalization(unitId: SQLWrapper): SQL {
	return eq(unitLocalization.position, primaryUnitLocalizationPosition(unitId));
}

/** Resolve the first localization-specific cover, preserving localization order. */
export function firstUnitLocalizationCoverAssetId(unitId: SQLWrapper): SQL<string | null> {
	return sql<string | null>`(
		select "cover_localization"."cover_asset_id"
		from "unit_localization" as "cover_localization"
		where "cover_localization"."unit_id" = ${unitId}
			and "cover_localization"."cover_asset_id" is not null
		order by "cover_localization"."position", "cover_localization"."language"
		limit 1
	)`;
}

/**
 * Move an existing localization to the first position without changing the
 * relative order of the remaining localizations.
 */
export async function makePrimaryUnitLocalization(
	tx: DatabaseTransaction,
	unitId: string,
	language: string,
): Promise<void> {
	const localizations = await tx
		.select({ language: unitLocalization.language, position: unitLocalization.position })
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, unitId))
		.orderBy(unitLocalization.position, unitLocalization.language);
	const primary = localizations[0];
	const selected = localizations.find((localization) => localization.language === language);
	if (!primary || !selected)
		throw new Error(`Cannot make missing localization ${language} primary for Unit ${unitId}`);
	if (primary.language === selected.language) return;

	const firstPosition = fractionalPositionBetween(null, primary.position);
	await tx
		.update(unitLocalization)
		.set({ position: firstPosition })
		.where(
			and(
				eq(unitLocalization.unitId, unitId),
				eq(unitLocalization.language, selected.language),
			),
		);
}

/** Select the primary display title without joining a second localization role. */
export function primaryUnitTitle(unitId: SQLWrapper): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.title}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by ${unitLocalization.position}, ${unitLocalization.language}
		limit 1
	)`;
}

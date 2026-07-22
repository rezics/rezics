import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";

import type { DatabaseTransaction } from "../database";
import { unitLocalization } from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";

export const UnitLocalizationImageRoles = ["avatar", "banner", "cover"] as const;
export type UnitLocalizationImageRole = (typeof UnitLocalizationImageRoles)[number];
export interface UnitLocalizationImageAssetInput {
	avatarAssetId?: string | null;
	bannerAssetId?: string | null;
	coverAssetId?: string | null;
}

export function unitLocalizationImageAssetIds(
	input: UnitLocalizationImageAssetInput,
): readonly (string | null | undefined)[] {
	return [input.avatarAssetId, input.bannerAssetId, input.coverAssetId];
}

const mediaLocalization = alias(unitLocalization, "media_localization");
const mediaAssetColumns = {
	avatar: mediaLocalization.avatarAssetId,
	banner: mediaLocalization.bannerAssetId,
	cover: mediaLocalization.coverAssetId,
} as const satisfies Record<UnitLocalizationImageRole, SQLWrapper>;

const mediaAssetKeys = {
	avatar: "avatarAssetId",
	banner: "bannerAssetId",
	cover: "coverAssetId",
} as const satisfies Record<UnitLocalizationImageRole, keyof UnitLocalizationImageAssetInput>;

/** Resolve from rows already ordered by position and language. */
export function resolveUnitLocalizationImageAssetIdFromOrdered(
	localizations: readonly (UnitLocalizationImageAssetInput & { language: string })[],
	role: UnitLocalizationImageRole,
	preferredLanguage?: string | null,
): string | null {
	const assetKey = mediaAssetKeys[role];
	const preferred = preferredLanguage
		? localizations.find(
				(localization) =>
					localization.language === preferredLanguage && Boolean(localization[assetKey]),
			)
		: undefined;
	return (
		preferred?.[assetKey] ??
		localizations.find((localization) => localization[assetKey])?.[assetKey] ??
		null
	);
}

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

/** Resolve a locale override, then the first available image in localization order. */
export function resolvedUnitLocalizationImageAssetId(
	unitId: SQLWrapper,
	role: UnitLocalizationImageRole,
	preferredLanguage?: string | null,
): SQL<string | null> {
	const assetColumn = mediaAssetColumns[role];
	return sql<string | null>`(
		select ${assetColumn}
		from ${unitLocalization} as ${mediaLocalization}
		where ${mediaLocalization.unitId} = ${unitId}
			and ${assetColumn} is not null
		order by
			case when ${preferredLanguage ?? null}::text is not null
				and ${mediaLocalization.language} = ${preferredLanguage ?? null}::text
				then 0 else 1 end,
			${mediaLocalization.position},
			${mediaLocalization.language}
		limit 1
	)`;
}

export function firstUnitLocalizationCoverAssetId(unitId: SQLWrapper): SQL<string | null> {
	return resolvedUnitLocalizationImageAssetId(unitId, "cover");
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

/** Select the primary display summary without joining a second localization role. */
export function primaryUnitSummary(unitId: SQLWrapper): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.summary}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by ${unitLocalization.position}, ${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization, then fall back to the primary localization. */
export function resolvedUnitLocalizationLanguage(
	unitId: SQLWrapper,
	preferredLanguage?: string | null,
): SQL<ContentLanguage | null> {
	return sql<ContentLanguage | null>`(
		select ${unitLocalization.language}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			case when ${preferredLanguage ?? null}::text is not null
				and ${unitLocalization.language} = ${preferredLanguage ?? null}::text
				then 0 else 1 end,
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization's title, then fall back to the primary localization. */
export function resolvedUnitLocalizationTitle(
	unitId: SQLWrapper,
	preferredLanguage?: string | null,
): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.title}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			case when ${preferredLanguage ?? null}::text is not null
				and ${unitLocalization.language} = ${preferredLanguage ?? null}::text
				then 0 else 1 end,
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

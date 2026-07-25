import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
	FontAwesomeProvider,
	type AvatarReference,
	type AvatarType,
	type FontAwesomeIconPrefix,
} from "@rezics/avatar";
import type { ContentLanguage } from "@rezics/i18n";

import type { DatabaseTransaction } from "../database";
import { unitLocalization } from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";

export const UnitLocalizationImageRoles = ["banner", "cover"] as const;
export type UnitLocalizationImageRole = (typeof UnitLocalizationImageRoles)[number];
export interface UnitLocalizationImageAssetInput {
	avatar?: AvatarReference | null;
	bannerAssetId?: string | null;
	coverAssetId?: string | null;
}

export interface UnitLocalizationAvatarColumns {
	avatarType: AvatarType | null;
	avatarAssetId: string | null;
	avatarEmoji: string | null;
	avatarIconPrefix: FontAwesomeIconPrefix | null;
	avatarIconName: string | null;
}

export function unitLocalizationImageAssetIds(
	input: UnitLocalizationImageAssetInput,
): readonly (string | null | undefined)[] {
	return [
		input.avatar?.type === "image" ? input.avatar.image.assetId : undefined,
		input.bannerAssetId,
		input.coverAssetId,
	];
}

export function avatarReferenceToColumns(
	avatar: AvatarReference | null,
): UnitLocalizationAvatarColumns {
	switch (avatar?.type) {
		case undefined:
			return {
				avatarType: null,
				avatarAssetId: null,
				avatarEmoji: null,
				avatarIconPrefix: null,
				avatarIconName: null,
			};
		case "image":
			return {
				avatarType: "image",
				avatarAssetId: avatar.image.assetId,
				avatarEmoji: null,
				avatarIconPrefix: null,
				avatarIconName: null,
			};
		case "emoji":
			return {
				avatarType: "emoji",
				avatarAssetId: null,
				avatarEmoji: avatar.emoji,
				avatarIconPrefix: null,
				avatarIconName: null,
			};
		case "icon":
			return {
				avatarType: "icon",
				avatarAssetId: null,
				avatarEmoji: null,
				avatarIconPrefix: avatar.icon.prefix,
				avatarIconName: avatar.icon.name,
			};
	}
}

export function toUnitLocalizationStorage<Input extends object>(
	input: Input & { readonly avatar?: AvatarReference | null },
): Omit<Input, "avatar"> & Partial<UnitLocalizationAvatarColumns> {
	const { avatar, ...stored } = input;
	return {
		...stored,
		...(Object.hasOwn(input, "avatar") ? avatarReferenceToColumns(avatar ?? null) : {}),
	};
}

export function avatarReferenceFromColumns(
	columns: UnitLocalizationAvatarColumns,
): AvatarReference | null {
	switch (columns.avatarType) {
		case null:
			return null;
		case "image":
			if (!columns.avatarAssetId) throw new Error("Stored image avatar has no asset id");
			return { type: "image", image: { assetId: columns.avatarAssetId } };
		case "emoji":
			if (!columns.avatarEmoji) throw new Error("Stored emoji avatar has no emoji");
			return { type: "emoji", emoji: columns.avatarEmoji };
		case "icon":
			if (!columns.avatarIconPrefix || !columns.avatarIconName)
				throw new Error("Stored icon avatar is incomplete");
			return {
				type: "icon",
				icon: {
					provider: FontAwesomeProvider,
					prefix: columns.avatarIconPrefix,
					name: columns.avatarIconName,
				},
			};
	}
}

const mediaLocalization = alias(unitLocalization, "media_localization");
const mediaAssetColumns = {
	banner: mediaLocalization.bannerAssetId,
	cover: mediaLocalization.coverAssetId,
} as const satisfies Record<UnitLocalizationImageRole, SQLWrapper>;

const mediaAssetKeys = {
	banner: "bannerAssetId",
	cover: "coverAssetId",
} as const satisfies Record<UnitLocalizationImageRole, keyof UnitLocalizationImageAssetInput>;

type LocalizationLanguagePreference = string | readonly string[] | null | undefined;

function preferredLanguageOrder(
	languageColumn: SQLWrapper,
	preference: LocalizationLanguagePreference,
): SQL {
	const languages =
		typeof preference === "string" ? [preference] : preference ? [...preference] : [];
	if (!languages.length) return sql`0::int`;
	return sql`case ${languageColumn}
		${sql.join(
			languages.map((language, index) => sql`when ${language}::text then ${index}`),
			sql` `,
		)}
		else ${languages.length}
	end`;
}

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

/** Resolve a complete avatar override from rows already ordered by position and language. */
export function resolveUnitLocalizationAvatarFromOrdered(
	localizations: readonly (UnitLocalizationAvatarColumns & { language: string })[],
	preferredLanguage?: string | null,
): AvatarReference | null {
	const preferred = preferredLanguage
		? localizations.find(
				(localization) =>
					localization.language === preferredLanguage && localization.avatarType !== null,
			)
		: undefined;
	const resolved = preferred ?? localizations.find(({ avatarType }) => avatarType !== null);
	return resolved ? avatarReferenceFromColumns(resolved) : null;
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
	preferredLanguage?: LocalizationLanguagePreference,
): SQL<string | null> {
	const assetColumn = mediaAssetColumns[role];
	return sql<string | null>`(
		select ${assetColumn}
		from ${unitLocalization} as ${mediaLocalization}
		where ${mediaLocalization.unitId} = ${unitId}
			and ${assetColumn} is not null
		order by
			${preferredLanguageOrder(mediaLocalization.language, preferredLanguage)},
			${mediaLocalization.position},
			${mediaLocalization.language}
		limit 1
	)`;
}

/** Resolve a locale override, then the first complete avatar in localization order. */
export function resolvedUnitLocalizationAvatar(
	unitId: SQLWrapper,
	preferredLanguage?: LocalizationLanguagePreference,
): SQL<AvatarReference | null> {
	return sql<AvatarReference | null>`(
		select case ${mediaLocalization.avatarType}
			when 'image' then jsonb_build_object(
				'type', 'image',
				'image', jsonb_build_object('assetId', ${mediaLocalization.avatarAssetId})
			)
			when 'emoji' then jsonb_build_object(
				'type', 'emoji',
				'emoji', ${mediaLocalization.avatarEmoji}
			)
			when 'icon' then jsonb_build_object(
				'type', 'icon',
				'icon', jsonb_build_object(
					'provider', ${FontAwesomeProvider}::text,
					'prefix', ${mediaLocalization.avatarIconPrefix},
					'name', ${mediaLocalization.avatarIconName}
				)
			)
		end
		from ${unitLocalization} as ${mediaLocalization}
		where ${mediaLocalization.unitId} = ${unitId}
			and ${mediaLocalization.avatarType} is not null
		order by
			${preferredLanguageOrder(mediaLocalization.language, preferredLanguage)},
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
	preferredLanguage?: LocalizationLanguagePreference,
): SQL<ContentLanguage | null> {
	return sql<ContentLanguage | null>`(
		select ${unitLocalization.language}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			${preferredLanguageOrder(unitLocalization.language, preferredLanguage)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization's title, then fall back to the primary localization. */
export function resolvedUnitLocalizationTitle(
	unitId: SQLWrapper,
	preferredLanguage?: LocalizationLanguagePreference,
): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.title}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			${preferredLanguageOrder(unitLocalization.language, preferredLanguage)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization's summary, then fall back to the primary localization. */
export function resolvedUnitLocalizationSummary(
	unitId: SQLWrapper,
	preferredLanguage?: LocalizationLanguagePreference,
): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.summary}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			${preferredLanguageOrder(unitLocalization.language, preferredLanguage)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

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

export function unitLocalizationImageAssetReferences(
	input: UnitLocalizationImageAssetInput,
): readonly {
	readonly assetId: string | null | undefined;
	readonly role: "avatar" | UnitLocalizationImageRole;
}[] {
	return [
		{
			assetId: input.avatar?.type === "image" ? input.avatar.image.assetId : undefined,
			role: "avatar",
		},
		{ assetId: input.bannerAssetId, role: "banner" },
		{ assetId: input.coverAssetId, role: "cover" },
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

export type LocalizationLanguageQuery = readonly ContentLanguage[];

export function localizationLanguageOrder(
	languageColumn: SQLWrapper,
	languages: LocalizationLanguageQuery = [],
): SQL {
	if (!languages.length) return sql`0::int`;
	const languageArray = sql`array[${sql.join(
		languages.map((language) => sql`${language}`),
		sql`, `,
	)}]::text[]`;
	return sql`coalesce(
		array_position(${languageArray}, ${languageColumn}),
		${languages.length + 1}
	)`;
}

export function resolveUnitLocalizationFromOrdered<
	Localization extends { readonly language: ContentLanguage },
>(
	localizations: readonly Localization[],
	languages: LocalizationLanguageQuery,
): Localization | undefined {
	const localizationsByLanguage = new Map(
		localizations.map((localization) => [localization.language, localization]),
	);
	for (const language of languages) {
		const localization = localizationsByLanguage.get(language);
		if (localization) return localization;
	}
	return localizations[0];
}

/** Resolve from rows already ordered by position and language. */
export function resolveUnitLocalizationImageAssetIdFromOrdered(
	localizations: readonly (UnitLocalizationImageAssetInput & {
		language: ContentLanguage;
	})[],
	role: UnitLocalizationImageRole,
	languages: LocalizationLanguageQuery = [],
): string | null {
	const assetKey = mediaAssetKeys[role];
	for (const language of languages) {
		const assetId = localizations.find(
			(localization) => localization.language === language && Boolean(localization[assetKey]),
		)?.[assetKey];
		if (assetId) return assetId;
	}
	return localizations.find((localization) => localization[assetKey])?.[assetKey] ?? null;
}

/** Resolve a complete avatar override from rows already ordered by position and language. */
export function resolveUnitLocalizationAvatarFromOrdered(
	localizations: readonly (UnitLocalizationAvatarColumns & {
		language: ContentLanguage;
	})[],
	languages: LocalizationLanguageQuery = [],
): AvatarReference | null {
	let resolved: (UnitLocalizationAvatarColumns & { language: ContentLanguage }) | undefined;
	for (const language of languages) {
		resolved = localizations.find(
			(localization) =>
				localization.language === language && localization.avatarType !== null,
		);
		if (resolved) break;
	}
	resolved ??= localizations.find(({ avatarType }) => avatarType !== null);
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
	languages: LocalizationLanguageQuery = [],
): SQL<string | null> {
	const assetColumn = mediaAssetColumns[role];
	return sql<string | null>`(
		select ${assetColumn}
		from ${unitLocalization} as ${mediaLocalization}
		where ${mediaLocalization.unitId} = ${unitId}
			and ${assetColumn} is not null
		order by
			${localizationLanguageOrder(mediaLocalization.language, languages)},
			${mediaLocalization.position},
			${mediaLocalization.language}
		limit 1
	)`;
}

/** Resolve a locale override, then the first complete avatar in localization order. */
export function resolvedUnitLocalizationAvatar(
	unitId: SQLWrapper,
	languages: LocalizationLanguageQuery = [],
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
			${localizationLanguageOrder(mediaLocalization.language, languages)},
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
	languages: LocalizationLanguageQuery = [],
): SQL<ContentLanguage | null> {
	return sql<ContentLanguage | null>`(
		select ${unitLocalization.language}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			${localizationLanguageOrder(unitLocalization.language, languages)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization's title, then fall back to the primary localization. */
export function resolvedUnitLocalizationTitle(
	unitId: SQLWrapper,
	languages: LocalizationLanguageQuery = [],
): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.title}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			${localizationLanguageOrder(unitLocalization.language, languages)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization's summary, then fall back to the primary localization. */
export function resolvedUnitLocalizationSummary(
	unitId: SQLWrapper,
	languages: LocalizationLanguageQuery = [],
): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.summary}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by
			${localizationLanguageOrder(unitLocalization.language, languages)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

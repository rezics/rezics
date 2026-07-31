import { and, eq, inArray, sql, type SQL, type SQLWrapper } from "drizzle-orm";
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
import { fractionalPositionAt, fractionalPositionBetween } from "../ordering/position";
import {
	UnitLastLocalizationRemovalForbidden,
	UnitLocalizationNotFound,
	UnitLocalizationOrderChanged,
	UnitLocalizationOrderInvalid,
} from "./errors";

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

function localizationLanguageCondition(
	languageColumn: SQLWrapper,
	allowedLanguages: LocalizationLanguageQuery = [],
): SQL {
	return allowedLanguages.length ? inArray(languageColumn, allowedLanguages) : sql`true`;
}

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
	allowedLanguages: LocalizationLanguageQuery = [],
): Localization | undefined {
	const allowedLanguageSet = allowedLanguages.length ? new Set(allowedLanguages) : undefined;
	const eligibleLocalizations = allowedLanguageSet
		? localizations.filter(({ language }) => allowedLanguageSet.has(language))
		: localizations;
	const localizationsByLanguage = new Map(
		eligibleLocalizations.map((localization) => [localization.language, localization]),
	);
	for (const language of languages) {
		const localization = localizationsByLanguage.get(language);
		if (localization) return localization;
	}
	return eligibleLocalizations[0];
}

/** Resolve from rows already ordered by position and language. */
export function resolveUnitLocalizationImageAssetIdFromOrdered(
	localizations: readonly (UnitLocalizationImageAssetInput & {
		language: ContentLanguage;
	})[],
	role: UnitLocalizationImageRole,
	languages: LocalizationLanguageQuery = [],
	allowedLanguages: LocalizationLanguageQuery = [],
): string | null {
	const allowedLanguageSet = allowedLanguages.length ? new Set(allowedLanguages) : undefined;
	const eligibleLocalizations = allowedLanguageSet
		? localizations.filter(({ language }) => allowedLanguageSet.has(language))
		: localizations;
	const assetKey = mediaAssetKeys[role];
	for (const language of languages) {
		const assetId = eligibleLocalizations.find(
			(localization) => localization.language === language && Boolean(localization[assetKey]),
		)?.[assetKey];
		if (assetId) return assetId;
	}
	return eligibleLocalizations.find((localization) => localization[assetKey])?.[assetKey] ?? null;
}

/** Resolve a complete avatar override from rows already ordered by position and language. */
export function resolveUnitLocalizationAvatarFromOrdered(
	localizations: readonly (UnitLocalizationAvatarColumns & {
		language: ContentLanguage;
	})[],
	languages: LocalizationLanguageQuery = [],
	allowedLanguages: LocalizationLanguageQuery = [],
): AvatarReference | null {
	const allowedLanguageSet = allowedLanguages.length ? new Set(allowedLanguages) : undefined;
	const eligibleLocalizations = allowedLanguageSet
		? localizations.filter(({ language }) => allowedLanguageSet.has(language))
		: localizations;
	let resolved: (UnitLocalizationAvatarColumns & { language: ContentLanguage }) | undefined;
	for (const language of languages) {
		resolved = eligibleLocalizations.find(
			(localization) =>
				localization.language === language && localization.avatarType !== null,
		);
		if (resolved) break;
	}
	resolved ??= eligibleLocalizations.find(({ avatarType }) => avatarType !== null);
	return resolved ? avatarReferenceFromColumns(resolved) : null;
}

/** Return the first position in the Unit's ordered content-language fallback sequence. */
function firstUnitLocalizationPosition(unitId: SQLWrapper): SQL<string | null> {
	return sql<string | null>`(
		select "first_localization"."position"
		from "unit_localization" as "first_localization"
		where "first_localization"."unit_id" = ${unitId}
		order by "first_localization"."position", "first_localization"."language"
		limit 1
	)`;
}

export function isFirstUnitLocalization(unitId: SQLWrapper): SQL {
	return eq(unitLocalization.position, firstUnitLocalizationPosition(unitId));
}

/** Resolve a locale override, then the first available image in localization order. */
export function resolvedUnitLocalizationImageAssetId(
	unitId: SQLWrapper,
	role: UnitLocalizationImageRole,
	languages: LocalizationLanguageQuery = [],
	allowedLanguages: LocalizationLanguageQuery = [],
): SQL<string | null> {
	const assetColumn = mediaAssetColumns[role];
	return sql<string | null>`(
		select ${assetColumn}
		from ${unitLocalization} as ${mediaLocalization}
		where ${mediaLocalization.unitId} = ${unitId}
			and ${assetColumn} is not null
			and ${localizationLanguageCondition(mediaLocalization.language, allowedLanguages)}
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
	allowedLanguages: LocalizationLanguageQuery = [],
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
			and ${localizationLanguageCondition(mediaLocalization.language, allowedLanguages)}
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

function contentLanguageOrdersEqual(
	left: readonly ContentLanguage[],
	right: readonly ContentLanguage[],
): boolean {
	return (
		left.length === right.length && left.every((language, index) => language === right[index])
	);
}

function contentLanguageSetsEqual(
	left: readonly ContentLanguage[],
	right: readonly ContentLanguage[],
): boolean {
	if (left.length !== right.length) return false;
	const rightSet = new Set(right);
	return left.every((language) => rightSet.has(language));
}

/**
 * Atomically replace a Unit's complete content-language fallback order.
 *
 * @remarks
 * The expected order is an optimistic concurrency proof. The candidate order
 * must contain the same non-empty language set, so this operation cannot add or
 * remove content.
 */
export async function reorderUnitLocalizations(
	tx: DatabaseTransaction,
	unitId: string,
	expectedLanguages: readonly ContentLanguage[],
	languages: readonly ContentLanguage[],
): Promise<boolean> {
	const localizations = await tx
		.select({ language: unitLocalization.language, position: unitLocalization.position })
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, unitId))
		.orderBy(unitLocalization.position, unitLocalization.language)
		.for("update");
	const currentLanguages = localizations.map(({ language }) => language);
	if (!contentLanguageOrdersEqual(currentLanguages, expectedLanguages))
		throw new UnitLocalizationOrderChanged(currentLanguages);
	if (!currentLanguages.length || !contentLanguageSetsEqual(currentLanguages, languages))
		throw new UnitLocalizationOrderInvalid();
	if (contentLanguageOrdersEqual(currentLanguages, languages)) return false;

	let temporaryPosition = localizations.at(-1)?.position;
	for (const localization of localizations) {
		temporaryPosition = fractionalPositionBetween(temporaryPosition, null);
		await tx
			.update(unitLocalization)
			.set({ position: temporaryPosition })
			.where(
				and(
					eq(unitLocalization.unitId, unitId),
					eq(unitLocalization.language, localization.language),
				),
			);
	}
	for (const [index, language] of languages.entries())
		await tx
			.update(unitLocalization)
			.set({ position: fractionalPositionAt(index) })
			.where(
				and(eq(unitLocalization.unitId, unitId), eq(unitLocalization.language, language)),
			);
	return true;
}

/**
 * Remove one Unit content language while preserving the non-empty invariant.
 */
export async function removeUnitLocalization(
	tx: DatabaseTransaction,
	unitId: string,
	language: ContentLanguage,
	expectedLanguages: readonly ContentLanguage[],
): Promise<ContentLanguage[]> {
	const localizations = await tx
		.select({ language: unitLocalization.language })
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, unitId))
		.orderBy(unitLocalization.position, unitLocalization.language)
		.for("update");
	const currentLanguages = localizations.map((localization) => localization.language);
	if (!contentLanguageOrdersEqual(currentLanguages, expectedLanguages))
		throw new UnitLocalizationOrderChanged(currentLanguages);
	if (!currentLanguages.includes(language)) throw new UnitLocalizationNotFound();
	if (currentLanguages.length === 1) throw new UnitLastLocalizationRemovalForbidden();
	await tx
		.delete(unitLocalization)
		.where(and(eq(unitLocalization.unitId, unitId), eq(unitLocalization.language, language)));
	return currentLanguages.filter((currentLanguage) => currentLanguage !== language);
}

/** Select the first fallback display title without joining a second localization role. */
export function firstUnitLocalizationTitle(unitId: SQLWrapper): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.title}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by ${unitLocalization.position}, ${unitLocalization.language}
		limit 1
	)`;
}

/** Select the first fallback display summary without joining a second localization role. */
export function firstUnitLocalizationSummary(unitId: SQLWrapper): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.summary}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
		order by ${unitLocalization.position}, ${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization, then use the Unit's fallback language order. */
export function resolvedUnitLocalizationLanguage(
	unitId: SQLWrapper,
	languages: LocalizationLanguageQuery = [],
	allowedLanguages: LocalizationLanguageQuery = [],
): SQL<ContentLanguage | null> {
	return sql<ContentLanguage | null>`(
		select ${unitLocalization.language}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
			and ${localizationLanguageCondition(unitLocalization.language, allowedLanguages)}
		order by
			${localizationLanguageOrder(unitLocalization.language, languages)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization's title, then use the Unit's fallback language order. */
export function resolvedUnitLocalizationTitle(
	unitId: SQLWrapper,
	languages: LocalizationLanguageQuery = [],
	allowedLanguages: LocalizationLanguageQuery = [],
): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.title}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
			and ${localizationLanguageCondition(unitLocalization.language, allowedLanguages)}
		order by
			${localizationLanguageOrder(unitLocalization.language, languages)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

/** Resolve the requested localization's summary, then use the Unit's fallback language order. */
export function resolvedUnitLocalizationSummary(
	unitId: SQLWrapper,
	languages: LocalizationLanguageQuery = [],
	allowedLanguages: LocalizationLanguageQuery = [],
): SQL<string | null> {
	return sql<string | null>`(
		select ${unitLocalization.summary}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
			and ${localizationLanguageCondition(unitLocalization.language, allowedLanguages)}
		order by
			${localizationLanguageOrder(unitLocalization.language, languages)},
			${unitLocalization.position},
			${unitLocalization.language}
		limit 1
	)`;
}

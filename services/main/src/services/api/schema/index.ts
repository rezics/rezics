import { type Static, t } from "elysia";
import { FormatRegistry } from "@sinclair/typebox";
import {
	FontAwesomeIconNamePatternSource,
	FontAwesomeIconPrefixValues,
	FontAwesomeProvider,
	isSingleEmojiGrapheme,
} from "@rezics/avatar";
import { PortableTextDocument } from "@rezics/block";
import { PublicationLicenseIds } from "@rezics/license";

import {
	AiDisclosureValues,
	ChineseContentDisplayValues,
	ContentLanguageValues,
	ContentRatingValues,
	NonRealmUnitKindValues,
	ResourceVisibilityValues,
	StoredUiLocaleValues,
	UnitKindValues,
	UnitStatusValues,
	WorkReleaseStatusValues,
} from "../../database/schema/contract-values";
import { isFractionalPosition } from "../../ordering/position";

FormatRegistry.Set("fractional-position", isFractionalPosition);
FormatRegistry.Set("single-emoji-grapheme", isSingleEmojiGrapheme);

/** A content-language group accepted by authoring, discovery, and storage. */
export const ContentLanguage = t.UnionEnum(ContentLanguageValues, { default: undefined });
export type ContentLanguage = Static<typeof ContentLanguage>;

/** A persisted preference controlling presentation-only Chinese script conversion. */
export const ChineseContentDisplay = t.UnionEnum(ChineseContentDisplayValues, {
	default: undefined,
});
export type ChineseContentDisplay = Static<typeof ChineseContentDisplay>;

/** A persisted content-visibility rating accepted and returned by the public API. */
export const ContentRating = t.UnionEnum(ContentRatingValues, { default: undefined });
export type ContentRating = Static<typeof ContentRating>;

/**
 * Ordered localization lookup hints supplied by an API consumer.
 *
 * These are presentation preferences, not a collection filter. A lookup
 * always falls back to the Unit's own localization order when none match.
 */
export const LocalizationLanguagePriority = t.Array(ContentLanguage, {
	minItems: 1,
	maxItems: ContentLanguageValues.length,
	uniqueItems: true,
});
export type LocalizationLanguagePriority = Static<typeof LocalizationLanguagePriority>;

export const LocalizationLanguageQuery = {
	localizationLanguages: t.Optional(LocalizationLanguagePriority),
};

/** A canonical BCP 47 UI locale value persisted in profile preferences. */
export const StoredUiLocale = t.UnionEnum(StoredUiLocaleValues, { default: undefined });
export type StoredUiLocale = Static<typeof StoredUiLocale>;

/** A persisted Unit discriminator accepted and returned by the public API. */
export const UnitKind = t.UnionEnum(UnitKindValues, { default: undefined });
export type UnitKind = Static<typeof UnitKind>;

/** The release lifecycle of a Book or Media work, independent of Unit publication. */
export const WorkReleaseStatus = t.UnionEnum(WorkReleaseStatusValues, { default: undefined });
export type WorkReleaseStatus = Static<typeof WorkReleaseStatus>;

/** A persisted Unit discriminator excluding Realm-only settings branches. */
export const NonRealmUnitKind = t.UnionEnum(NonRealmUnitKindValues, { default: undefined });
export type NonRealmUnitKind = Static<typeof NonRealmUnitKind>;

/** A persisted disclosure control shared by Units, Scores, and Progress. */
export const ResourceVisibility = t.UnionEnum(ResourceVisibilityValues, {
	default: undefined,
});
export type ResourceVisibility = Static<typeof ResourceVisibility>;

/** A REZICS publication License ID accepted and returned by the public API. */
export const PublicationLicense = t.UnionEnum(PublicationLicenseIds, {
	default: undefined,
});
export type PublicationLicense = Static<typeof PublicationLicense>;

export const DateTimeString = t.String({ format: "date-time" });

export const DateTime = t
	.Transform(DateTimeString)
	.Decode((value) => new Date(value))
	.Encode((value) => value.toISOString());

export const Uuid = t.String({ format: "uuid" });
export type Uuid = Static<typeof Uuid>;

export const AvatarInput = t.Union([
	t.Object(
		{ type: t.Literal("image"), image: t.Object({ assetId: Uuid }) },
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("emoji"),
			emoji: t.String({ format: "single-emoji-grapheme", maxLength: 64 }),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			type: t.Literal("icon"),
			icon: t.Object(
				{
					provider: t.Literal(FontAwesomeProvider),
					prefix: t.UnionEnum(FontAwesomeIconPrefixValues, { default: undefined }),
					name: t.String({
						pattern: FontAwesomeIconNamePatternSource,
						maxLength: 128,
					}),
				},
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
]);
export type AvatarInput = Static<typeof AvatarInput>;

/** Optional per-language presentation overrides. Null removes an override and inherits. */
export const LocalizationImageInput = {
	avatar: t.Optional(t.Nullable(AvatarInput)),
	bannerAssetId: t.Optional(t.Nullable(Uuid)),
	coverAssetId: t.Optional(t.Nullable(Uuid)),
};

/** A case-sensitive fractional index used by mutable ordered sequences. */
export const FractionalPosition = t.String({
	format: "fractional-position",
	minLength: 2,
	maxLength: 512,
});

/** A zero-based dense position used by sequences replaced atomically. */
export const OrdinalPosition = t.Integer({ minimum: 0 });

/** A zero-based observed position in a rendered recommendation result. */
export const DisplayPosition = t.Integer({ minimum: 0, maximum: 999 });

export const UnitIdParams = t.Object({ unitId: Uuid });
export type UnitIdParams = Static<typeof UnitIdParams>;

export const LocalizationInput = t.Object(
	{
		language: ContentLanguage,
		title: t.String({ minLength: 1, maxLength: 500 }),
		summary: t.Optional(t.String({ maxLength: 2_000 })),
		description: t.Optional(PortableTextDocument),
		...LocalizationImageInput,
	},
	{ additionalProperties: false },
);
export type LocalizationInput = Static<typeof LocalizationInput>;

export const LifecycleInput = {
	status: t.Optional(t.Union(UnitStatusValues.map((value) => t.Literal(value)))),
	visibility: t.Optional(ResourceVisibility),
	contentRating: t.Optional(ContentRating),
	aiDisclosure: t.Optional(t.Union(AiDisclosureValues.map((value) => t.Literal(value)))),
	license: t.Optional(t.Nullable(PublicationLicense)),
};
export type LifecycleInput = {
	[K in keyof typeof LifecycleInput]: Static<(typeof LifecycleInput)[K]>;
};

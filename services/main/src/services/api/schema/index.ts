import { type Static, t } from "elysia";
import { FormatRegistry } from "@sinclair/typebox";
import type { TSchema } from "@sinclair/typebox";
import {
	FontAwesomeIconNamePatternSource,
	FontAwesomeIconPrefixValues,
	FontAwesomeProvider,
	isSingleEmojiGrapheme,
} from "@rezics/avatar";
import { PortableTextDocument } from "@rezics/block";
import {
	ContentLanguageChannelValues,
	MaximumContentLanguageSupportEntries,
	MaximumContentLanguageTagLength,
} from "@rezics/content-language";
import { LicenseIds } from "@rezics/license";

import {
	AiDisclosureValues,
	ChineseContentDisplayValues,
	ContentLanguageValues,
	ContentRatingValues,
	FollowableUnitKindValues,
	NonRealmUnitKindValues,
	NonRealmFollowableUnitKindValues,
	ResourceVisibilityValues,
	RevisionAttributionAssuranceValues,
	RevisionContributionRoleValues,
	StoredUiLocaleValues,
	UnitKindValues,
	UnitStatusValues,
	WorkReleaseStatusValues,
} from "../../database/schema/contract-values";
import {
	FractionalPositionInputMaximumBytes,
	FractionalPositionStorageMaximumBytes,
	isFractionalPosition,
} from "../../ordering/position";

FormatRegistry.Set("fractional-position", isFractionalPosition);
FormatRegistry.Set("single-emoji-grapheme", isSingleEmojiGrapheme);

/** A content-language group accepted by authoring, discovery, and storage. */
export const ContentLanguage = t.UnionEnum(ContentLanguageValues, { default: undefined });
export type ContentLanguage = Static<typeof ContentLanguage>;

/** A consumption-language tag; service normalization proves canonical BCP 47 form. */
export const ContentLanguageTag = t.String({
	minLength: 1,
	maxLength: MaximumContentLanguageTagLength,
	pattern: "^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$",
});
export type ContentLanguageTag = Static<typeof ContentLanguageTag>;

export const ContentLanguageChannel = t.UnionEnum(ContentLanguageChannelValues);
export type ContentLanguageChannel = Static<typeof ContentLanguageChannel>;

export const ContentLanguageSupportEntry = t.Object(
	{
		languageTag: ContentLanguageTag,
		channels: t.Optional(
			t.Array(ContentLanguageChannel, {
				minItems: 1,
				maxItems: ContentLanguageChannelValues.length,
				uniqueItems: true,
			}),
		),
	},
	{ additionalProperties: false },
);
export type ContentLanguageSupportEntry = Static<typeof ContentLanguageSupportEntry>;

/** The single authoritative, bounded content-consumption language field. */
export const ContentLanguageSupport = t.Array(ContentLanguageSupportEntry, {
	maxItems: MaximumContentLanguageSupportEntries,
});
export type ContentLanguageSupport = Static<typeof ContentLanguageSupport>;

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
 * These are presentation preferences, not a collection filter. An omitted or
 * empty sequence delegates presentation to the Unit's own localization order.
 */
export const LocalizationLanguageHints = t.Array(ContentLanguage, {
	maxItems: ContentLanguageValues.length,
	uniqueItems: true,
});
export type LocalizationLanguageHints = Static<typeof LocalizationLanguageHints>;

export const LocalizationLanguageQuery = {
	localizationLanguages: t.Optional(LocalizationLanguageHints),
};

/** The common identity field carried by every localization contract. */
export const LocalizationLanguageField = { language: ContentLanguage } as const;

/** A non-empty, bounded localization sequence; its order is the fallback order. */
export const localizationSet = <Schema extends TSchema>(schema: Schema) =>
	t.Array(schema, { minItems: 1, maxItems: ContentLanguageValues.length });

/** JSON Schema cannot express uniqueness by one object property, so prove it at the boundary. */
export const hasUniqueLocalizationLanguages = (
	localizations: readonly { readonly language: ContentLanguage }[],
): boolean => new Set(localizations.map(({ language }) => language)).size === localizations.length;

/** A canonical BCP 47 UI locale value persisted in profile preferences. */
export const StoredUiLocale = t.UnionEnum(StoredUiLocaleValues, { default: undefined });
export type StoredUiLocale = Static<typeof StoredUiLocale>;

/** A persisted Unit discriminator accepted and returned by the public API. */
export const UnitKind = t.UnionEnum(UnitKindValues, { default: undefined });
export type UnitKind = Static<typeof UnitKind>;

/** A Unit discriminator admitted by generic Following surfaces. */
export const FollowableUnitKind = t.UnionEnum(FollowableUnitKindValues, { default: undefined });
export type FollowableUnitKind = Static<typeof FollowableUnitKind>;

/** A followable Unit discriminator excluding Realm-only settings branches. */
export const NonRealmFollowableUnitKind = t.UnionEnum(NonRealmFollowableUnitKindValues, {
	default: undefined,
});
export type NonRealmFollowableUnitKind = Static<typeof NonRealmFollowableUnitKind>;

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

/** A registered License ID accepted and returned by the public API. */
export const License = t.UnionEnum(LicenseIds, {
	default: undefined,
});
export type License = Static<typeof License>;

export const DateTimeString = t.String({ format: "date-time" });

export const DateTime = t
	.Transform(DateTimeString)
	.Decode((value) => new Date(value))
	.Encode((value) => value.toISOString());

export const Uuid = t.String({ format: "uuid" });
export type Uuid = Static<typeof Uuid>;

/** A client declaration of the primary semantic source of a revision. */
export const RevisionContributionInput = t.Union([
	t.Object({ primary: t.Literal("human") }, { additionalProperties: false }),
	t.Object({ primary: t.Literal("unattributed") }, { additionalProperties: false }),
	t.Object(
		{
			primary: t.Literal("ai"),
			creditedEntityId: Uuid,
			role: t.UnionEnum(RevisionContributionRoleValues),
		},
		{ additionalProperties: false },
	),
]);
export type RevisionContributionInput = Static<typeof RevisionContributionInput>;

export const RevisionContext = t.Object(
	{ contribution: t.Optional(RevisionContributionInput) },
	{ additionalProperties: false },
);
export type RevisionContext = Static<typeof RevisionContext>;

/** Optional body shape for commands whose only mutation context is revision provenance. */
export const RevisionContextBody = t.Object(
	{ revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
export type RevisionContextBody = Static<typeof RevisionContextBody>;

/** The normalized contribution union returned by history reads. */
export const RevisionPrimaryContribution = t.Union([
	t.Object({ kind: t.Literal("human") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("unattributed") }, { additionalProperties: false }),
	t.Object(
		{
			kind: t.Literal("ai"),
			creditAttribution: t.Object(
				{
					creditedEntityId: Uuid,
					role: t.UnionEnum(RevisionContributionRoleValues),
					assurance: t.UnionEnum(RevisionAttributionAssuranceValues),
				},
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
]);
export type RevisionPrimaryContribution = Static<typeof RevisionPrimaryContribution>;

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

/** A persisted case-sensitive fractional index returned by mutable ordered sequences. */
export const FractionalPosition = t.String({
	format: "fractional-position",
	minLength: 2,
	maxLength: FractionalPositionStorageMaximumBytes,
});

/** External position input cannot consume the server's compaction safety margin. */
export const FractionalPositionInput = t.String({
	format: "fractional-position",
	minLength: 2,
	maxLength: FractionalPositionInputMaximumBytes,
});

/** A zero-based dense position used by sequences replaced atomically. */
export const OrdinalPosition = t.Integer({ minimum: 0 });

/** A zero-based observed position in a rendered recommendation result. */
export const DisplayPosition = t.Integer({ minimum: 0, maximum: 999 });

export const UnitIdParams = t.Object({ unitId: Uuid });
export type UnitIdParams = Static<typeof UnitIdParams>;

export const UnitLocalizationContentFields = {
	title: t.String({ minLength: 1, maxLength: 500 }),
	summary: t.Optional(t.String({ maxLength: 2_000 })),
	description: t.Optional(PortableTextDocument),
	...LocalizationImageInput,
} as const;
export const UnitLocalizationInput = t.Object(
	{ ...LocalizationLanguageField, ...UnitLocalizationContentFields },
	{ additionalProperties: false },
);
export type UnitLocalizationInput = Static<typeof UnitLocalizationInput>;

export const LifecycleInput = {
	status: t.Optional(t.Union(UnitStatusValues.map((value) => t.Literal(value)))),
	visibility: t.Optional(ResourceVisibility),
	contentRating: t.Optional(ContentRating),
	aiDisclosure: t.Optional(t.Union(AiDisclosureValues.map((value) => t.Literal(value)))),
	licenses: t.Optional(t.Array(License, { uniqueItems: true, maxItems: LicenseIds.length })),
};
export type LifecycleInput = {
	[K in keyof typeof LifecycleInput]: Static<(typeof LifecycleInput)[K]>;
};

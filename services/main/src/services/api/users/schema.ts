import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { LicenseIds } from "@rezics/license";
import { Value } from "typebox/value";
import { PortableTextDocument } from "@rezics/block";

import {
	ContentLanguageValues,
	ResourceVisibilityValues,
	UnitKindValues,
	UnitStatusValues,
} from "../../database/schema/contract-values";
import { NullablePublicSlugAddressResponse, SlugLabelInput } from "../slug-addresses/schema";
import {
	AvatarInput,
	ChineseContentDisplay,
	ContentLanguage,
	ContentRating,
	DateTime,
	FollowableUnitKind,
	FractionalPositionInput,
	LocalizationLanguageQuery,
	NonRealmFollowableUnitKind,
	License,
	RevisionContext,
	ResourceVisibility,
	StoredUiLocale,
	Uuid,
} from "../schema";
import { ResourceSectionValues, type ResourceSection } from "../../units/resource-section";

export const StudioSection = t.UnionEnum(ResourceSectionValues, { default: undefined });
export type StudioSection = ResourceSection;

export const StudioWorkspaceSourceValues = ["all", "owned", "direct", "delegated"] as const;
export const StudioWorkspaceSource = t.UnionEnum(StudioWorkspaceSourceValues, { default: "all" });
export type StudioWorkspaceSource = StaticDecode<typeof StudioWorkspaceSource>;

export const StudioAccessSourceValues = ["owner", "direct", "realm"] as const;
export const StudioAccessSource = t.UnionEnum(StudioAccessSourceValues, {
	default: undefined,
});
export type StudioAccessSource = StaticDecode<typeof StudioAccessSource>;

export const StudioContentListQuery = t.Object(
	{
		section: StudioSection,
		source: t.Optional(StudioWorkspaceSource),
		status: t.Optional(t.UnionEnum(UnitStatusValues, { default: undefined })),
		visibility: t.Optional(t.UnionEnum(ResourceVisibilityValues, { default: undefined })),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ maxLength: 1_024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
	},
	{ additionalProperties: false },
);
export type StudioContentListQuery = StaticDecode<typeof StudioContentListQuery>;

export const StudioContentListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slugAddress: NullablePublicSlugAddressResponse,
			section: StudioSection,
			resourceKind: t.UnionEnum(UnitKindValues),
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			cover: t.Nullable(t.Object({ id: Uuid, url: t.String() })),
			status: t.UnionEnum(UnitStatusValues),
			visibility: t.UnionEnum(ResourceVisibilityValues),
			accessSources: t.Array(StudioAccessSource, {
				minItems: 1,
				uniqueItems: true,
			}),
			assignedAt: DateTime,
			lastVisitedAt: t.Nullable(DateTime),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	nextCursor: t.Nullable(t.String()),
});

export const StudioResourceParams = t.Object({ unitId: Uuid });
export type StudioResourceParams = StaticDecode<typeof StudioResourceParams>;

export const StudioVisitResponse = t.Object({
	unitId: Uuid,
	lastVisitedAt: DateTime,
});

export const CollectionConfigV1 = t.Object(
	{
		version: t.Literal(1),
		view: t.Optional(t.UnionEnum(["grid", "list"])),
		addMainWithVariantByDefault: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false, minProperties: 1 },
);
export type CollectionConfigV1 = StaticDecode<typeof CollectionConfigV1>;

export function parseCollectionConfig(value: unknown): CollectionConfigV1 | null {
	if (value === null) return null;
	return Value.Decode(CollectionConfigV1, value);
}

export const UpdateProfileBody = t.Object(
	{
		updatedAt: t.String({ format: "date-time" }),
		language: ContentLanguage,
		name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
		avatar: t.Optional(t.Nullable(AvatarInput)),
		bannerAssetId: t.Optional(t.Nullable(Uuid)),
		summary: t.Optional(t.String({ maxLength: 500 })),
		description: t.Optional(PortableTextDocument),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UpdateProfileBody = StaticDecode<typeof UpdateProfileBody>;

/**
 * Temporary first-party request for assigning the current Profile slug.
 *
 * @remarks
 * This contract is intended for the interactive REZICS application while
 * Profile slug governance remains assign-once. It is excluded from the public
 * API-token SDK.
 *
 * @alpha
 */
export const AssignCurrentProfileSlugBody = t.Object(
	{ slug: SlugLabelInput },
	{ additionalProperties: false },
);
export type AssignCurrentProfileSlugBody = StaticDecode<typeof AssignCurrentProfileSlugBody>;

export const UpdateDisplayPreferencesBody = t.Object(
	{
		interfaceLocale: t.Optional(StoredUiLocale),
		chineseContentDisplay: t.Optional(ChineseContentDisplay),
		alwaysShowSpoilers: t.Optional(t.Boolean()),
		alwaysShowNsfw: t.Optional(t.Boolean()),
		customThemesEnabled: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false, minProperties: 1 },
);
export type UpdateDisplayPreferencesBody = StaticDecode<typeof UpdateDisplayPreferencesBody>;

export const UpdatePrivacyPreferencesBody = t.Object(
	{
		scoreVisibility: t.Optional(ResourceVisibility),
		progressVisibility: t.Optional(ResourceVisibility),
	},
	{ additionalProperties: false, minProperties: 1 },
);
export type UpdatePrivacyPreferencesBody = StaticDecode<typeof UpdatePrivacyPreferencesBody>;

export const ReplacePreferencesBody = t.Object(
	{
		interfaceLocale: StoredUiLocale,
		chineseContentDisplay: ChineseContentDisplay,
		defaultLicenses: t.Array(License, { uniqueItems: true, maxItems: LicenseIds.length }),
		defaultRealmManageMode: t.Boolean({ default: false }),
		defaultScoreRealmId: Uuid,
		collectionConfig: t.Nullable(CollectionConfigV1),
		personalizedFeed: t.Boolean({ default: true }),
		customThemesEnabled: t.Boolean({ default: true }),
		filterFeedByPreferredLanguages: t.Boolean({ default: false }),
		alwaysShowSpoilers: t.Boolean({ default: false }),
		alwaysShowNsfw: t.Boolean({ default: false }),
		contentRatings: t.Array(ContentRating, {
			minItems: 1,
			uniqueItems: true,
		}),
		preferredLanguages: t.Array(ContentLanguage, {
			minItems: 1,
			maxItems: ContentLanguageValues.length,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
export type ReplacePreferencesBody = StaticDecode<typeof ReplacePreferencesBody>;

export const UserLookupParams = t.Object({ id: Uuid });
export type UserLookupParams = StaticDecode<typeof UserLookupParams>;

export const PublicProfileQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type PublicProfileQuery = StaticDecode<typeof PublicProfileQuery>;

export const ProfileActivityQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ProfileActivityQuery = StaticDecode<typeof ProfileActivityQuery>;

export const UserIdParams = t.Object({ id: Uuid });
export type UserIdParams = StaticDecode<typeof UserIdParams>;

export const FollowingUnitParams = t.Object({ unitId: Uuid });
export type FollowingUnitParams = StaticDecode<typeof FollowingUnitParams>;

export const FollowingListQuery = t.Object(
	{
		kind: t.Optional(FollowableUnitKind),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ maxLength: 1_024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
	},
	{ additionalProperties: false },
);
export type FollowingListQuery = StaticDecode<typeof FollowingListQuery>;

export const UpdateFollowingBody = t.Object(
	{
		favorite: t.Optional(t.Boolean()),
		position: t.Optional(FractionalPositionInput),
	},
	{ additionalProperties: false },
);
export type UpdateFollowingBody = StaticDecode<typeof UpdateFollowingBody>;

const FollowingNotificationSettings = {
	inAppNotificationsEnabled: t.Boolean(),
} as const;

export const ReplaceFollowingSettingsBody = t.Union([
	t.Object(
		{
			kind: t.Literal("realm"),
			...FollowingNotificationSettings,
			realmTagSourceSubscribed: t.Boolean(),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			kind: NonRealmFollowableUnitKind,
			...FollowingNotificationSettings,
			realmTagSourceSubscribed: t.Null(),
		},
		{ additionalProperties: false },
	),
]);
export type ReplaceFollowingSettingsBody = StaticDecode<typeof ReplaceFollowingSettingsBody>;

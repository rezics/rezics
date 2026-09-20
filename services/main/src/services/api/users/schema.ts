export {
	CollectionConfigV1,
	parseCollectionConfig,
	UpdateDisplayPreferencesBody,
	UpdatePrivacyPreferencesBody,
	ReplacePreferencesBody,
} from "../../account/preference-contracts";
import { UnitOwnerValues } from "@rezics/reference";
import { PortableTextDocument } from "@rezics/block";
import { t } from "elysia";
import type { StaticDecode } from "typebox";

import {
	ResourceVisibilityValues,
	UnitStatusValues,
} from "@rezics/schema/postgres/shared/contract-values";
import { ResourceSectionValues, type ResourceSection } from "../../units/resource-section";
import {
	AvatarInput,
	DateTime,
	FollowableUnitOwner,
	FractionalPositionInput,
	LocalizationLanguageQuery,
	NonRealmFollowableUnitOwner,
	RevisionContext,
	Uuid,
} from "../schema";
import { NullablePublicSlugAddressResponse, SlugLabelInput } from "../slug-addresses/schema";

export const StudioSection = t.UnionEnum(ResourceSectionValues, { default: undefined });
export type StudioSection = ResourceSection;

export const StudioWorkspaceSourceValues = [
	"all",
	"created",
	"owned",
	"direct",
	"delegated",
] as const;
export const StudioWorkspaceSource = t.UnionEnum(StudioWorkspaceSourceValues, { default: "all" });
export type StudioWorkspaceSource = StaticDecode<typeof StudioWorkspaceSource>;

export const StudioAccessSourceValues = [
	"owner",
	"direct",
	"realm",
	"catalog_creator",
	"catalog_grant",
] as const;
export const StudioAccessSource = t.UnionEnum(StudioAccessSourceValues, {
	default: undefined,
});
export type StudioAccessSource = StaticDecode<typeof StudioAccessSource>;

export const StudioContentListQuery = t.Object(
	{
		section: t.Optional(StudioSection),
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
			resourceOwner: t.UnionEnum(UnitOwnerValues),
			resourceShape: t.String(),
			language: t.Nullable(t.String({ maxLength: 255 })),
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

export const UpdateEntityPresentationBody = t.Object(
	{
		expectedRevision: t.Integer({ minimum: 0 }),
		language: t.String({ minLength: 1, maxLength: 255 }),
		name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
		avatar: t.Optional(t.Nullable(AvatarInput)),
		bannerAssetId: t.Optional(t.Nullable(Uuid)),
		summary: t.Optional(t.String({ maxLength: 500 })),
		description: t.Optional(PortableTextDocument),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UpdateEntityPresentationBody = StaticDecode<typeof UpdateEntityPresentationBody>;

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

export const UserLookupParams = t.Object({ id: Uuid });
export type UserLookupParams = StaticDecode<typeof UserLookupParams>;

export const EntityPresentationQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type EntityPresentationQuery = StaticDecode<typeof EntityPresentationQuery>;

export const EntityActivityQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type EntityActivityQuery = StaticDecode<typeof EntityActivityQuery>;

export const UserIdParams = t.Object({ id: Uuid });
export type UserIdParams = StaticDecode<typeof UserIdParams>;

export const FollowingUnitParams = t.Object({ unitId: Uuid });
export type FollowingUnitParams = StaticDecode<typeof FollowingUnitParams>;

export const FollowingListQuery = t.Object(
	{
		owner: t.Optional(FollowableUnitOwner),
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
			owner: t.Literal("realm"),
			...FollowingNotificationSettings,
			realmTagSourceSubscribed: t.Boolean(),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			owner: NonRealmFollowableUnitOwner,
			...FollowingNotificationSettings,
			realmTagSourceSubscribed: t.Null(),
		},
		{ additionalProperties: false },
	),
]);
export type ReplaceFollowingSettingsBody = StaticDecode<typeof ReplaceFollowingSettingsBody>;

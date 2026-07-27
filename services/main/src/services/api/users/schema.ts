import { type Static, t } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { PortableTextDocument } from "@rezics/block";

import {
	ContentLanguageValues,
	ContentRatingValues,
	UnitStatusValues,
	UnitVisibilityValues,
} from "../../database/schema/contract-values";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";
import {
	AvatarInput,
	ContentLanguage,
	DateTime,
	FractionalPosition,
	LocalizationLanguageQuery,
	PublicationLicense,
	StoredUiLocale,
	UnitKind,
	Uuid,
} from "../schema";

export const StudioSectionValues = [
	"book",
	"software",
	"media",
	"entity",
	"tag",
	"realm",
	"zone",
	"post",
	"wiki",
	"collection",
	"review",
	"poll",
] as const;
export const StudioSection = t.UnionEnum(StudioSectionValues, { default: undefined });
export type StudioSection = Static<typeof StudioSection>;

export const StudioViewValues = ["all", "created", "contributed", "assigned", "delegated"] as const;
export const StudioView = t.UnionEnum(StudioViewValues, { default: "all" });
export type StudioView = Static<typeof StudioView>;

export const StudioPermissionValues = [
	"unit.update",
	"unit.publish",
	"unit.access.manage",
] as const;
export const StudioPermission = t.UnionEnum(StudioPermissionValues, { default: undefined });
export type StudioPermission = Static<typeof StudioPermission>;

export const StudioWorkStateValues = ["actionable", "blocked"] as const;
export const StudioWorkState = t.UnionEnum(StudioWorkStateValues, { default: undefined });
export type StudioWorkState = Static<typeof StudioWorkState>;

export const StudioSortValues = ["recent", "updated", "created", "relevant"] as const;
export const StudioSort = t.UnionEnum(StudioSortValues, { default: "recent" });
export type StudioSort = Static<typeof StudioSort>;

export const StudioRelationValues = ["created", "contributed", "assigned", "delegated"] as const;
export const StudioRelation = t.UnionEnum(StudioRelationValues, { default: undefined });
export type StudioRelation = Static<typeof StudioRelation>;

export const StudioAccessSourceValues = ["direct", "realm", "authenticated", "platform"] as const;
export const StudioAccessSource = t.UnionEnum(StudioAccessSourceValues, {
	default: undefined,
});
export type StudioAccessSource = Static<typeof StudioAccessSource>;

export const StudioContentListQuery = t.Object(
	{
		section: StudioSection,
		view: t.Optional(StudioView),
		permission: t.Optional(StudioPermission),
		workState: t.Optional(StudioWorkState),
		status: t.Optional(t.UnionEnum(UnitStatusValues, { default: undefined })),
		visibility: t.Optional(t.UnionEnum(UnitVisibilityValues, { default: undefined })),
		sort: t.Optional(StudioSort),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ maxLength: 1_024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type StudioContentListQuery = Static<typeof StudioContentListQuery>;

export const StudioContentListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slugAddress: NullablePublicSlugAddressResponse,
			section: StudioSection,
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			status: t.UnionEnum(UnitStatusValues),
			visibility: t.UnionEnum(UnitVisibilityValues),
			relations: t.Array(StudioRelation, { minItems: 1, uniqueItems: true }),
			workState: StudioWorkState,
			permissions: t.Array(StudioPermission, { uniqueItems: true }),
			accessSources: t.Array(StudioAccessSource, { uniqueItems: true }),
			firstContributedAt: t.Nullable(DateTime),
			lastContributedAt: t.Nullable(DateTime),
			contributionCount: t.Integer({ minimum: 0 }),
			assignedAt: t.Nullable(DateTime),
			lastVisitedAt: t.Nullable(DateTime),
			relevantAt: DateTime,
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	nextCursor: t.Nullable(t.String()),
});

export const StudioResourceParams = t.Object({ unitId: Uuid });
export type StudioResourceParams = Static<typeof StudioResourceParams>;

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
export type CollectionConfigV1 = Static<typeof CollectionConfigV1>;

export function parseCollectionConfig(value: unknown): CollectionConfigV1 | null {
	if (value === null) return null;
	return Value.Decode(CollectionConfigV1, value);
}

export const UpdateProfileBody = t.Object(
	{
		updatedAt: t.String({ format: "date-time" }),
		name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
		avatar: t.Optional(t.Nullable(AvatarInput)),
		bannerAssetId: t.Optional(t.Nullable(Uuid)),
		summary: t.Optional(t.String({ maxLength: 500 })),
		description: t.Optional(PortableTextDocument),
	},
	{ additionalProperties: false },
);
export type UpdateProfileBody = Static<typeof UpdateProfileBody>;

export const UpdateInterfaceLocaleBody = t.Object(
	{ interfaceLocale: StoredUiLocale },
	{ additionalProperties: false },
);
export type UpdateInterfaceLocaleBody = Static<typeof UpdateInterfaceLocaleBody>;

export const ReplacePreferencesBody = t.Object(
	{
		interfaceLocale: StoredUiLocale,
		defaultLicense: t.Nullable(PublicationLicense),
		defaultRealmManageMode: t.Boolean({ default: false }),
		defaultScoreContextUnitId: Uuid,
		collectionConfig: t.Nullable(CollectionConfigV1),
		personalizedFeed: t.Boolean({ default: true }),
		filterFeedByPreferredLanguages: t.Boolean({ default: false }),
		contentRatings: t.Array(t.Union(ContentRatingValues.map((value) => t.Literal(value))), {
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
export type ReplacePreferencesBody = Static<typeof ReplacePreferencesBody>;

export const UserLookupParams = t.Object({ id: Uuid });
export type UserLookupParams = Static<typeof UserLookupParams>;

export const PublicProfileQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type PublicProfileQuery = Static<typeof PublicProfileQuery>;

export const UserIdParams = t.Object({ id: Uuid });
export type UserIdParams = Static<typeof UserIdParams>;

export const FollowingUnitParams = t.Object({ unitId: Uuid });
export type FollowingUnitParams = Static<typeof FollowingUnitParams>;

export const FollowingListQuery = t.Object(
	{
		kind: t.Optional(UnitKind),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ maxLength: 1_024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
	},
	{ additionalProperties: false },
);
export type FollowingListQuery = Static<typeof FollowingListQuery>;

export const UpdateFollowingBody = t.Object(
	{
		favorite: t.Optional(t.Boolean()),
		position: t.Optional(FractionalPosition),
	},
	{ additionalProperties: false },
);
export type UpdateFollowingBody = Static<typeof UpdateFollowingBody>;

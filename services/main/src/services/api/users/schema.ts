import { type Static, t } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { PortableTextDocument } from "@rezics/block";

import {
	ContentLanguageValues,
	ContentRatingValues,
	UnitStatusValues,
	UnitVisibilityValues,
} from "../../database/schema/contract-values";
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
	"collection",
	"review",
	"poll",
] as const;
export const StudioSection = t.UnionEnum(StudioSectionValues);
export type StudioSection = Static<typeof StudioSection>;

export const StudioContentListQuery = t.Object(
	{
		section: StudioSection,
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type StudioContentListQuery = Static<typeof StudioContentListQuery>;

export const StudioContentListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			section: StudioSection,
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			status: t.UnionEnum(UnitStatusValues),
			visibility: t.UnionEnum(UnitVisibilityValues),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
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

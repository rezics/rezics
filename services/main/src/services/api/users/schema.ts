import { type Static, t } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { PortableTextDocument } from "@rezics/block";

import { ContentRatingValues } from "../../database/schema/contract-values";
import { FractionalPosition, LanguageTag, Uuid } from "../schema";

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
		avatarAssetId: t.Optional(t.Nullable(Uuid)),
		bannerAssetId: t.Optional(t.Nullable(Uuid)),
		summary: t.Optional(t.String({ maxLength: 500 })),
		description: t.Optional(PortableTextDocument),
	},
	{ additionalProperties: false },
);
export type UpdateProfileBody = Static<typeof UpdateProfileBody>;

export const ReplacePreferencesBody = t.Object({
	defaultLicense: t.Nullable(t.String({ minLength: 1, maxLength: 128 })),
	defaultRealmManageMode: t.Boolean({ default: false }),
	collectionConfig: t.Nullable(CollectionConfigV1),
	personalizedFeed: t.Boolean({ default: true }),
	contentRatings: t.Array(t.Union(ContentRatingValues.map((value) => t.Literal(value))), {
		uniqueItems: true,
	}),
	preferredLanguages: t.Array(LanguageTag, {
		minItems: 1,
		uniqueItems: true,
	}),
});
export type ReplacePreferencesBody = Static<typeof ReplacePreferencesBody>;

export const UserLookupParams = t.Object({ id: Uuid });
export type UserLookupParams = Static<typeof UserLookupParams>;

export const UserIdParams = t.Object({ id: Uuid });
export type UserIdParams = Static<typeof UserIdParams>;

export const SubscriptionUnitParams = t.Object({ unitId: Uuid });
export type SubscriptionUnitParams = Static<typeof SubscriptionUnitParams>;

export const UpdateSubscriptionBody = t.Object(
	{
		favorite: t.Optional(t.Boolean()),
		position: t.Optional(FractionalPosition),
	},
	{ additionalProperties: false },
);
export type UpdateSubscriptionBody = Static<typeof UpdateSubscriptionBody>;

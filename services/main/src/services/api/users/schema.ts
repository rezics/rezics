import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/content-structure";

import { ContentRatingValues } from "../../database/schema/contract-values";
import { LanguageTag, Uuid } from "../schema";

export const UpdateProfileBody = t.Object(
	{
		updatedAt: t.String({ format: "date-time" }),
		slug: t.Optional(
			t.String({
				minLength: 3,
				maxLength: 64,
				pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
			}),
		),
		name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
		avatarAssetId: t.Optional(t.Nullable(Uuid)),
		summary: t.Optional(t.String({ maxLength: 500 })),
		description: t.Optional(PortableTextDocument),
	},
	{ additionalProperties: false },
);
export type UpdateProfileBody = Static<typeof UpdateProfileBody>;

export const ReplacePreferencesBody = t.Object({
	defaultLicense: t.Nullable(t.String({ minLength: 1, maxLength: 128 })),
	defaultRealmManageMode: t.Boolean({ default: false }),
	collectionConfig: t.Nullable(t.Record(t.String(), t.Unknown())),
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

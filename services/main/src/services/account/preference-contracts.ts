import { t } from "elysia";
import type { StaticDecode } from "typebox";
import { Value } from "typebox/value";
import { LicenseIds } from "@rezics/license";
import { ContentLanguageValues } from "@rezics/schema/postgres/shared/contract-values";
import {
	ChineseContentDisplay,
	ContentLanguage,
	ContentRating,
	License,
	ResourceVisibility,
	StoredUiLocale,
	Uuid,
} from "../api/schema";

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

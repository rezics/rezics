import { type Static, t } from "elysia";
import { FormatRegistry } from "@sinclair/typebox";
import { PortableTextDocument } from "@rezics/block";

import {
	AiDisclosureValues,
	ContentLanguageValues,
	ContentRatingValues,
	StoredUiLocaleValues,
	UnitKindValues,
	UnitStatusValues,
	UnitVisibilityValues,
} from "../../database/schema/contract-values";
import { isFractionalPosition } from "../../ordering/position";

FormatRegistry.Set("fractional-position", isFractionalPosition);

/** A content-language group accepted by authoring, discovery, and storage. */
export const ContentLanguage = t.Union([
	t.Literal(ContentLanguageValues[0]),
	t.Literal(ContentLanguageValues[1]),
]);
export type ContentLanguage = Static<typeof ContentLanguage>;

/** A lowercase UI locale value persisted in profile preferences. */
export const StoredUiLocale = t.Union([
	t.Literal(StoredUiLocaleValues[0]),
	t.Literal(StoredUiLocaleValues[1]),
]);
export type StoredUiLocale = Static<typeof StoredUiLocale>;

/** A persisted Unit discriminator accepted and returned by the public API. */
export const UnitKind = t.UnionEnum(UnitKindValues, { default: undefined });
export type UnitKind = Static<typeof UnitKind>;

export const DateTime = t
	.Transform(t.String({ format: "date-time" }))
	.Decode((value) => new Date(value))
	.Encode((value) => value.toISOString());

export const Uuid = t.String({ format: "uuid" });
export type Uuid = Static<typeof Uuid>;

/** Optional per-language presentation overrides. Null removes an override and inherits. */
export const LocalizationImageInput = {
	avatarAssetId: t.Optional(t.Nullable(Uuid)),
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
	visibility: t.Optional(t.Union(UnitVisibilityValues.map((value) => t.Literal(value)))),
	contentRating: t.Optional(t.Union(ContentRatingValues.map((value) => t.Literal(value)))),
	aiDisclosure: t.Optional(t.Union(AiDisclosureValues.map((value) => t.Literal(value)))),
	license: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
};
export type LifecycleInput = {
	[K in keyof typeof LifecycleInput]: Static<(typeof LifecycleInput)[K]>;
};

import { type Static, t } from "elysia";
import { FormatRegistry } from "@sinclair/typebox";
import { PortableText } from "@rezics/portable-text";
import tags from "language-tags";

import {
	AiDisclosureValues,
	ContentRatingValues,
	UnitStatusValues,
	UnitVisibilityValues,
} from "../../database/schema/contract-values";

FormatRegistry.Set("bcp-47", tags.check);

/** A well-formed BCP 47 language tag from the IANA language subtag registry. */
export const LanguageTag = t.String({ format: "bcp-47", minLength: 2, maxLength: 35 });
export type LanguageTag = Static<typeof LanguageTag>;

export const DateTime = t
	.Transform(t.String({ format: "date-time" }))
	.Decode((value) => new Date(value))
	.Encode((value) => value.toISOString());

export const Uuid = t.String({ format: "uuid" });
export type Uuid = Static<typeof Uuid>;

export const UnitIdParams = t.Object({ unitId: Uuid });
export type UnitIdParams = Static<typeof UnitIdParams>;

export const LocalizationInput = t.Object(
	{
		language: LanguageTag,
		title: t.String({ minLength: 1, maxLength: 500 }),
		summary: t.Optional(t.String({ maxLength: 2_000 })),
		description: t.Optional(PortableText),
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

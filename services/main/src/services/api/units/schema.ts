import { type Static, t } from "elysia";
import { ContentLanguageValues } from "@rezics/i18n";

import {
	DateTime,
	FractionalPosition,
	ContentLanguage,
	LifecycleInput,
	LocalizationLanguageQuery,
	LocalizationInput,
	Uuid,
} from "../schema";

export const VariantUnitType = t.Union([
	t.Literal("book"),
	t.Literal("software"),
	t.Literal("media"),
]);
export type VariantUnitType = Static<typeof VariantUnitType>;

export const CatalogUnitType = t.Union([VariantUnitType, t.Literal("series")]);
export type CatalogUnitType = Static<typeof CatalogUnitType>;

export const VariantUnitTypeParams = t.Object({ type: VariantUnitType });
export const CatalogUnitTypeParams = t.Object({ type: CatalogUnitType });

export const CatalogEntryMode = t.Union([t.Literal("owned_work"), t.Literal("public_entry")]);
export type CatalogEntryMode = Static<typeof CatalogEntryMode>;

export const PublisherEntityInput = t.Object({ entityId: Uuid }, { additionalProperties: false });
export type PublisherEntityInput = Static<typeof PublisherEntityInput>;

export const UnitVersionInput = t.Union([
	t.Object({ kind: t.Literal("main") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("variant"), mainUnitId: Uuid }, { additionalProperties: false }),
]);
export type UnitVersionInput = Static<typeof UnitVersionInput>;

export const UnitStatusEventParams = t.Object({ unitId: Uuid });
export const ResolveUnitPresentationsBody = t.Object(
	{ ids: t.Array(Uuid, { minItems: 1, maxItems: 100, uniqueItems: true }) },
	{ additionalProperties: false },
);
export const UnitStatusEventListQuery = t.Object({
	cursor: t.Optional(t.String()),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
});
const UnitStatusEventActorResponse = t.Union([
	t.Object({ kind: t.Literal("profile"), profileId: Uuid, name: t.Nullable(t.String()) }),
	t.Object({ kind: t.Literal("system") }),
	t.Object({ kind: t.Literal("import") }),
	t.Object({ kind: t.Literal("hidden") }),
]);
export const UnitStatusEventListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			unitId: Uuid,
			fromStatus: t.Nullable(t.UnionEnum(["draft", "published", "archived"])),
			toStatus: t.UnionEnum(["draft", "published", "archived"]),
			actor: UnitStatusEventActorResponse,
			revisionId: t.Nullable(Uuid),
			createdAt: DateTime,
		}),
	),
	nextCursor: t.Nullable(t.String()),
});

export const UnitSeriesMembershipListResponse = t.Object({
	items: t.Array(
		t.Object({
			series: t.Object({
				id: Uuid,
				title: t.Nullable(t.String()),
				cover: t.Nullable(t.Object({ id: Uuid, url: t.String() })),
			}),
			releaseUnitId: Uuid,
			position: FractionalPosition,
			releasedOn: t.Nullable(t.String({ format: "date" })),
			source: t.UnionEnum(["direct", "main"]),
		}),
	),
});

const UnitLocalizationInput = LocalizationInput;

const CreateUnitFields = {
	version: UnitVersionInput,
	localization: UnitLocalizationInput,
	visibility: LifecycleInput.visibility,
	contentRating: LifecycleInput.contentRating,
	aiDisclosure: LifecycleInput.aiDisclosure,
	license: LifecycleInput.license,
} as const;

export const CreateUnitBody = t.Union([
	t.Object(
		{
			catalogMode: t.Literal("owned_work"),
			publisher: PublisherEntityInput,
			...CreateUnitFields,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			catalogMode: t.Literal("public_entry"),
			publisher: t.Optional(PublisherEntityInput),
			...CreateUnitFields,
		},
		{ additionalProperties: false },
	),
]);
export type CreateUnitBody = Static<typeof CreateUnitBody>;

const UnitDetailsInput = t.Object(
	{
		isbn13: t.Optional(t.Nullable(t.String({ pattern: "^[0-9]{13}$" }))),
		publicationDate: t.Optional(t.Nullable(t.String({ format: "date" }))),
		pageCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		wordCount: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
		format: t.Optional(t.Nullable(t.String())),
		licensed: t.Optional(t.Boolean()),
		versionLabel: t.Optional(t.Nullable(t.String())),
		kind: t.Optional(t.String({ minLength: 1 })),
		runtimeMinutes: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		episodeCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		seasonCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
	},
	{ additionalProperties: false },
);

export const UpdateUnitBody = t.Object(
	{
		updatedAt: t.String({ format: "date-time" }),
		...LifecycleInput,
		unit: t.Optional(
			t.Object(
				{
					releasedOn: t.Optional(t.Nullable(t.String({ format: "date" }))),
				},
				{ additionalProperties: false },
			),
		),
		details: t.Optional(UnitDetailsInput),
	},
	{ additionalProperties: false },
);
export type UpdateUnitBody = Static<typeof UpdateUnitBody>;

export const ListUnitsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String()),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListUnitsQuery = Static<typeof ListUnitsQuery>;

export const UnitLookupParams = t.Object({
	type: CatalogUnitType,
	unitId: Uuid,
});
export type UnitLookupParams = Static<typeof UnitLookupParams>;
export const UnitDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type UnitDetailQuery = Static<typeof UnitDetailQuery>;

export const UnitUnitIdParams = t.Object({ type: CatalogUnitType, unitId: Uuid });
export type UnitUnitIdParams = Static<typeof UnitUnitIdParams>;
export const VariantUnitUnitIdParams = t.Object({ type: VariantUnitType, unitId: Uuid });

export const UpdateUnitVariantContextBody = t.Object(
	{
		mainUnitId: t.Nullable(Uuid),
		expectedMainUnitId: t.Nullable(Uuid),
	},
	{ additionalProperties: false },
);
export type UpdateUnitVariantContextBody = Static<typeof UpdateUnitVariantContextBody>;

export const PromoteUnitVariantBody = t.Object(
	{ expectedMainUnitId: Uuid },
	{ additionalProperties: false },
);
export type PromoteUnitVariantBody = Static<typeof PromoteUnitVariantBody>;

export const UnitLocalizationParams = t.Object({
	type: CatalogUnitType,
	unitId: t.String({ format: "uuid" }),
	language: ContentLanguage,
});
export type UnitLocalizationParams = Static<typeof UnitLocalizationParams>;

export const UnitLocalizationBody = t.Omit(UnitLocalizationInput, ["language"]);
export type UnitLocalizationBody = Static<typeof UnitLocalizationBody>;

const ContentLanguageOrder = t.Array(ContentLanguage, {
	minItems: 1,
	maxItems: ContentLanguageValues.length,
	uniqueItems: true,
});

export const UnitLocalizationOrderParams = t.Object({ unitId: Uuid });
export const UnitLocalizationDeleteParams = t.Object({
	unitId: Uuid,
	language: ContentLanguage,
});
export const UnitLocalizationOrderBody = t.Object(
	{
		expectedLanguages: ContentLanguageOrder,
		languages: ContentLanguageOrder,
	},
	{ additionalProperties: false },
);
export type UnitLocalizationOrderBody = Static<typeof UnitLocalizationOrderBody>;
export const UnitLocalizationDeleteBody = t.Object(
	{ expectedLanguages: ContentLanguageOrder },
	{ additionalProperties: false },
);
export type UnitLocalizationDeleteBody = Static<typeof UnitLocalizationDeleteBody>;
export const UnitLocalizationOrderResponse = t.Object({
	languages: ContentLanguageOrder,
});

import { type Static, t } from "elysia";

import { DateTime, LanguageTag, LifecycleInput, LocalizationInput, Uuid } from "../schema";

export const UnitType = t.Union([t.Literal("book"), t.Literal("software"), t.Literal("media")]);
export type UnitType = Static<typeof UnitType>;

export const UnitTypeParams = t.Object({ type: UnitType });
export type UnitTypeParams = Static<typeof UnitTypeParams>;

export const UnitStatusEventParams = t.Object({ unitId: Uuid });
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

const UnitLocalizationInput = LocalizationInput;

export const CreateUnitBody = t.Object(
	{
		localization: UnitLocalizationInput,
		visibility: LifecycleInput.visibility,
		contentRating: LifecycleInput.contentRating,
		aiDisclosure: LifecycleInput.aiDisclosure,
		license: LifecycleInput.license,
	},
	{ additionalProperties: false },
);
export type CreateUnitBody = Static<typeof CreateUnitBody>;

const UnitDetailsInput = t.Object(
	{
		isbn13: t.Optional(t.Nullable(t.String({ pattern: "^[0-9]{13}$" }))),
		publicationDate: t.Optional(t.Nullable(t.String({ format: "date" }))),
		pageCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
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
					primaryLanguage: t.Optional(LanguageTag),
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

export const ListUnitsQuery = t.Object({
	cursor: t.Optional(t.String()),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListUnitsQuery = Static<typeof ListUnitsQuery>;

export const UnitLookupParams = t.Object({
	type: UnitType,
	unitId: Uuid,
});
export type UnitLookupParams = Static<typeof UnitLookupParams>;

export const UnitUnitIdParams = t.Object({ type: UnitType, unitId: Uuid });
export type UnitUnitIdParams = Static<typeof UnitUnitIdParams>;

export const UnitLocalizationParams = t.Object({
	type: UnitType,
	unitId: t.String({ format: "uuid" }),
	language: LanguageTag,
});
export type UnitLocalizationParams = Static<typeof UnitLocalizationParams>;

export const UnitLocalizationBody = t.Omit(UnitLocalizationInput, ["language"]);
export type UnitLocalizationBody = Static<typeof UnitLocalizationBody>;

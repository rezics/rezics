import { type Static, t } from "elysia";

import { GovernanceReasonCodeValues } from "../../database/schema/contract-values";
import { LanguageTag, LifecycleInput, LocalizationInput, Uuid } from "../schema";

export const UnitType = t.Union([t.Literal("book"), t.Literal("software"), t.Literal("media")]);
export type UnitType = Static<typeof UnitType>;

export const UnitTypeParams = t.Object({ type: UnitType });
export type UnitTypeParams = Static<typeof UnitTypeParams>;

export const SlugLabelInput = t.String({
	minLength: 1,
	maxLength: 63,
	pattern: "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
});

const UnitLocalizationInput = LocalizationInput;

export const CreateUnitBody = t.Object(
	{
		localization: UnitLocalizationInput,
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 63, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
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

export const ResolveUnitPathBody = t.Object(
	{
		path: t.Array(SlugLabelInput, { minItems: 1, maxItems: 16 }),
	},
	{ additionalProperties: false },
);
export type ResolveUnitPathBody = Static<typeof ResolveUnitPathBody>;

export const ResolvedUnitPathResponse = t.Object({
	id: Uuid,
	kind: t.String(),
	path: t.Array(SlugLabelInput),
	canonicalPath: t.Array(SlugLabelInput),
	redirected: t.Boolean(),
});

const StaffSlugMutationInput = {
	scopeUnitId: Uuid,
	slug: SlugLabelInput,
	reasonCode: t.UnionEnum(GovernanceReasonCodeValues, { default: undefined }),
};

export const CreateSlugNamespaceBody = t.Object(StaffSlugMutationInput, {
	additionalProperties: false,
});
export type CreateSlugNamespaceBody = Static<typeof CreateSlugNamespaceBody>;

export const UpdateUnitAddressParams = t.Object({ unitId: Uuid });
export type UpdateUnitAddressParams = Static<typeof UpdateUnitAddressParams>;

export const UpdateUnitAddressBody = t.Object(StaffSlugMutationInput, {
	additionalProperties: false,
});
export type UpdateUnitAddressBody = Static<typeof UpdateUnitAddressBody>;

export const UnitAddressMutationResponse = t.Object({
	unitId: Uuid,
	redirectUnitId: Uuid,
	canonicalPath: t.Array(SlugLabelInput),
});

export const SlugNamespaceCreatedResponse = t.Object({
	id: Uuid,
	canonicalPath: t.Array(SlugLabelInput),
});

export const SlugRedirectParams = t.Object({ redirectUnitId: Uuid });
export type SlugRedirectParams = Static<typeof SlugRedirectParams>;

export const ReleaseSlugRedirectBody = t.Object(
	{
		reasonCode: t.UnionEnum(GovernanceReasonCodeValues, { default: undefined }),
	},
	{ additionalProperties: false },
);
export type ReleaseSlugRedirectBody = Static<typeof ReleaseSlugRedirectBody>;

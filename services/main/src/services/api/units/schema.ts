import { type Static, t } from "elysia";
import { ContentLanguageValues } from "@rezics/i18n";
import { UnitContentLicenseSlugs } from "@rezics/license";
import {
	CreditAttributionRoleValues,
	UnitOwnershipModeValues,
	ContentGovernanceActionKindValues,
	RealmUnitPublicationStateValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";

import {
	DateTime,
	FractionalPosition,
	ContentLanguage,
	LifecycleInput,
	LocalizationLanguagePriority,
	LocalizationLanguageQuery,
	LocalizationInput,
	Uuid,
	WorkReleaseStatus,
} from "../schema";

export const VariantUnitType = t.Union([
	t.Literal("book"),
	t.Literal("software"),
	t.Literal("media"),
]);
export type VariantUnitType = Static<typeof VariantUnitType>;

export const WorkUnitType = t.Union([VariantUnitType, t.Literal("series")]);
export type WorkUnitType = Static<typeof WorkUnitType>;
export const TimedMediaUnitType = t.Union([t.Literal("video"), t.Literal("audio")]);
export type TimedMediaUnitType = Static<typeof TimedMediaUnitType>;
export const ManageableUnitType = t.Union([WorkUnitType, TimedMediaUnitType]);
export type ManageableUnitType = Static<typeof ManageableUnitType>;

export const VariantUnitTypeParams = t.Object({ type: VariantUnitType });
export const WorkUnitTypeParams = t.Object({ type: WorkUnitType });
export const ManageableUnitTypeParams = t.Object({ type: ManageableUnitType });

export const UnitOwnershipMode = t.Union(UnitOwnershipModeValues.map((value) => t.Literal(value)));
export type UnitOwnershipMode = Static<typeof UnitOwnershipMode>;

export const CreateUnitCreditAttributionInput = t.Object(
	{
		entityId: Uuid,
		role: t.Union(CreditAttributionRoleValues.map((role) => t.Literal(role))),
	},
	{ additionalProperties: false },
);
export type CreateUnitCreditAttributionInput = Static<typeof CreateUnitCreditAttributionInput>;

export const UnitVersionInput = t.Union([
	t.Object({ kind: t.Literal("main") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("variant"), mainUnitId: Uuid }, { additionalProperties: false }),
]);
export type UnitVersionInput = Static<typeof UnitVersionInput>;

export const UnitStatusEventParams = t.Object({ unitId: Uuid });
export const UnitRealmPublicationParams = t.Object({
	unitId: Uuid,
	realmId: Uuid,
});
export const ListUnitRealmPublicationsQuery = t.Object(
	{
		publicationState: t.Optional(
			t.UnionEnum([...RealmUnitPublicationStateValues, "all"], {
				default: "active",
			}),
		),
		realmStatus: t.Optional(
			t.UnionEnum(["current", ...RealmUnitStatusValues, "all"], {
				default: "current",
			}),
		),
		localizationLanguages: LocalizationLanguagePriority,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListUnitRealmPublicationsQuery = Static<typeof ListUnitRealmPublicationsQuery>;
export const UnitRealmPublicationListResponse = t.Object({
	items: t.Array(
		t.Object({
			realmId: Uuid,
			realmKind: t.Literal("realm"),
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			publicationState: t.UnionEnum(RealmUnitPublicationStateValues),
			status: t.UnionEnum(RealmUnitStatusValues),
			effectivelyVisible: t.Boolean(),
			latestGovernance: t.Nullable(
				t.Object({
					actionId: Uuid,
					actionKind: t.UnionEnum(ContentGovernanceActionKindValues),
					createdAt: DateTime,
				}),
			),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	nextCursor: t.Nullable(t.String()),
});
export const UnitSeriesMembershipQuery = t.Object(
	{ localizationLanguages: LocalizationLanguagePriority },
	{ additionalProperties: false },
);
export const ResolveUnitPresentationsBody = t.Object(
	{
		ids: t.Array(Uuid, { minItems: 1, maxItems: 100, uniqueItems: true }),
		localizationLanguages: LocalizationLanguagePriority,
	},
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
				language: ContentLanguage,
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
const UnitContentLicenseGrantInput = t.Object(
	{ referenceLicenseSlug: t.UnionEnum(UnitContentLicenseSlugs) },
	{
		additionalProperties: false,
		description:
			"One-time Unit content license grant. Omit this field when no new grant is being made.",
	},
);

const CreateUnitFields = {
	creditAttributionRequestConsent: t.Union([
		t.Literal("direct_only"),
		t.Literal("allow_requests"),
	]),
	version: UnitVersionInput,
	localization: UnitLocalizationInput,
	visibility: LifecycleInput.visibility,
	contentRating: LifecycleInput.contentRating,
	aiDisclosure: LifecycleInput.aiDisclosure,
	license: LifecycleInput.license,
	details: t.Union([
		t.Object(
			{ type: t.Literal("book"), releaseStatus: WorkReleaseStatus },
			{ additionalProperties: false },
		),
		t.Object({ type: t.Literal("software") }, { additionalProperties: false }),
		t.Object(
			{ type: t.Literal("media"), releaseStatus: WorkReleaseStatus },
			{ additionalProperties: false },
		),
	]),
} as const;

export const CreateUnitBody = t.Union([
	t.Object(
		{
			ownershipMode: t.Literal("profile_owned"),
			contentLicense: t.Optional(UnitContentLicenseGrantInput),
			creditAttributions: t.Array(CreateUnitCreditAttributionInput, {
				uniqueItems: true,
			}),
			...CreateUnitFields,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			ownershipMode: t.Literal("community_owned"),
			creditAttributions: t.Array(CreateUnitCreditAttributionInput, {
				uniqueItems: true,
			}),
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
		contentLicense: t.Optional(UnitContentLicenseGrantInput),
		versionLabel: t.Optional(t.Nullable(t.String())),
		kind: t.Optional(t.String({ minLength: 1 })),
		runtimeMinutes: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		episodeCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		seasonCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		durationSeconds: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		releaseStatus: t.Optional(WorkReleaseStatus),
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
	type: ManageableUnitType,
	unitId: Uuid,
});
export type UnitLookupParams = Static<typeof UnitLookupParams>;
export const UnitDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type UnitDetailQuery = Static<typeof UnitDetailQuery>;

export const UnitUnitIdParams = t.Object({ type: ManageableUnitType, unitId: Uuid });
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
	type: ManageableUnitType,
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

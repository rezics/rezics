import { UnitOwnerValues } from "@rezics/reference";
import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { ContentLanguageValues } from "@rezics/i18n";
import {
	ContentGovernanceActionKindValues,
	MaximumAudioTracksPerVideo,
	MaximumContentLanguageEvidencePageSize,
	MaximumSubjectAssociationsPageSize,
	RealmUnitPublicationStateValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";

import {
	DateTime,
	ContentLanguage,
	ContentLanguageTag,
	ContentLanguageSupport,
	ContentRating,
	LifecycleInput,
	LocalizationLanguageQuery,
	RevisionContext,
	UnitLocalizationContentFields,
	UnitLocalizationInput,
	Uuid,
} from "../schema";
import { PublicUnitSeoOwners } from "../../units/seo-contract";

export const TimedMediaUnitType = t.Union([t.Literal("video"), t.Literal("audio")]);
export type TimedMediaUnitType = StaticDecode<typeof TimedMediaUnitType>;
export const ManageableUnitType = TimedMediaUnitType;
export type ManageableUnitType = StaticDecode<typeof ManageableUnitType>;
export const ContentLanguageSupportUnitType = TimedMediaUnitType;
export type ContentLanguageSupportUnitType = StaticDecode<typeof ContentLanguageSupportUnitType>;
export const ContentLanguageEvidenceUnitType = TimedMediaUnitType;
export const TimedMediaUnitTypeParams = t.Object({ type: TimedMediaUnitType });
export const ManageableUnitTypeParams = TimedMediaUnitTypeParams;
export const ContentLanguageSupportUnitParams = t.Object({
	type: ContentLanguageSupportUnitType,
	unitId: Uuid,
});
export const ContentLanguageEvidenceUnitParams = t.Object({
	type: ContentLanguageEvidenceUnitType,
	unitId: Uuid,
});

export const ContentLanguageEvidenceQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
		limit: t.Optional(
			t.Integer({ minimum: 1, maximum: MaximumContentLanguageEvidencePageSize, default: 20 }),
		),
	},
	{ additionalProperties: false },
);

export const ContentLanguageEvidenceResponse = t.Object(
	{
		currentContentLanguageSupport: ContentLanguageSupport,
		items: t.Array(
			t.Object(
				{
					source: t.Literal("adapted_audio"),
					unit: t.Object(
						{
							id: Uuid,
							kind: t.Literal("audio"),
							language: t.Nullable(ContentLanguage),
							title: t.Nullable(t.String()),
						},
						{ additionalProperties: false },
					),
					contentLanguageSupport: ContentLanguageSupport,
					occurrence: t.Nullable(
						t.Object({ structureId: Uuid, nodeId: Uuid }, { additionalProperties: false }),
					),
				},
				{ additionalProperties: false },
			),
		),
		nextCursor: t.Nullable(t.String()),
	},
	{ additionalProperties: false },
);

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
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListUnitRealmPublicationsQuery = StaticDecode<typeof ListUnitRealmPublicationsQuery>;
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
export const ResolveUnitPresentationsBody = t.Object(
	{
		ids: t.Array(Uuid, { minItems: 1, maxItems: 100, uniqueItems: true }),
		...LocalizationLanguageQuery,
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

const CreateTimedMediaFields = {
	localization: UnitLocalizationInput,
	visibility: LifecycleInput.visibility,
	contentRating: LifecycleInput.contentRating,
	aiDisclosure: LifecycleInput.aiDisclosure,
	durationSeconds: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 2147483647 }))),
	revisionContext: t.Optional(RevisionContext),
};
export const CreateTimedMediaBody = t.Union([
	t.Object(
		{ ...CreateTimedMediaFields, owner: t.Literal("audio") },
		{ additionalProperties: false },
	),
	t.Object(
		{
			...CreateTimedMediaFields,
			owner: t.Literal("video"),
			adaptedAudioUnitIds: t.Optional(
				t.Array(Uuid, { maxItems: MaximumAudioTracksPerVideo, uniqueItems: true }),
			),
		},
		{ additionalProperties: false },
	),
]);
export type CreateTimedMediaBody = StaticDecode<typeof CreateTimedMediaBody>;
const UnitDetailsInput = t.Object(
	{
		durationSeconds: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 2147483647 }))),
		adaptedAudioUnitIds: t.Optional(
			t.Nullable(t.Array(Uuid, { maxItems: MaximumAudioTracksPerVideo, uniqueItems: true })),
		),
	},
	{ additionalProperties: false },
);

export const UpdateUnitBody = t.Object(
	{
		updatedAt: t.String({ format: "date-time" }),
		...LifecycleInput,
		contentLanguageSupport: t.Optional(ContentLanguageSupport),
		details: t.Optional(UnitDetailsInput),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UpdateUnitBody = StaticDecode<typeof UpdateUnitBody>;

export const ListUnitsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String()),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListUnitsQuery = StaticDecode<typeof ListUnitsQuery>;

export const UnitLookupParams = t.Object({
	type: ManageableUnitType,
	unitId: Uuid,
});
export type UnitLookupParams = StaticDecode<typeof UnitLookupParams>;

export const UnitDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type UnitDetailQuery = StaticDecode<typeof UnitDetailQuery>;

export const UnitSubjectAssociationsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 4096 })),
		limit: t.Optional(
			t.Integer({
				minimum: 1,
				maximum: MaximumSubjectAssociationsPageSize,
				default: MaximumSubjectAssociationsPageSize,
			}),
		),
	},
	{ additionalProperties: false },
);
export type UnitSubjectAssociationsQuery = StaticDecode<typeof UnitSubjectAssociationsQuery>;

export const PublicUnitSeoParams = t.Object({ unitId: Uuid });
export const PublicUnitSeoQuery = UnitDetailQuery;
const PublicUnitSeoContextResponse = t.Union([
	t.Object(
		{ kind: t.Literal("entity"), shape: t.String({ minLength: 1 }) },
		{ additionalProperties: false },
	),
	t.Object(
		{
			kind: t.Literal("zone_page"),
			zoneId: Uuid,
			zoneTitle: t.Nullable(t.String()),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{ kind: t.Literal("post"), attributionTitle: t.Nullable(t.String()) },
		{ additionalProperties: false },
	),
]);
const PublicUnitSeoPresentationResponse = t.Object(
	{
		language: t.Nullable(ContentLanguageTag),
		title: t.String({ minLength: 1, maxLength: 500 }),
		description: t.Nullable(t.String({ maxLength: 600 })),
		image: t.Nullable(t.Object({ id: Uuid, url: t.String() })),
		context: t.Nullable(PublicUnitSeoContextResponse),
	},
	{ additionalProperties: false },
);
const PublicUnitSeoIdentityResponse = {
	id: Uuid,
	owner: t.UnionEnum(PublicUnitSeoOwners),
	shape: t.String({ minLength: 1 }),
	contentRating: ContentRating,
	publishedAt: t.Nullable(DateTime),
	updatedAt: DateTime,
} as const;
export const PublicUnitSeoResponse = t.Union([
	t.Object(
		{
			...PublicUnitSeoIdentityResponse,
			indexing: t.Object({ state: t.Literal("index") }, { additionalProperties: false }),
			presentation: PublicUnitSeoPresentationResponse,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...PublicUnitSeoIdentityResponse,
			indexing: t.Object(
				{ state: t.Literal("noindex"), reason: t.Literal("unlisted") },
				{ additionalProperties: false },
			),
			presentation: PublicUnitSeoPresentationResponse,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...PublicUnitSeoIdentityResponse,
			indexing: t.Object(
				{
					state: t.Literal("noindex"),
					reason: t.Union([t.Literal("adult"), t.Literal("incomplete")]),
				},
				{ additionalProperties: false },
			),
			presentation: t.Null(),
		},
		{ additionalProperties: false },
	),
]);

export const UnitUnitIdParams = t.Object({ type: ManageableUnitType, unitId: Uuid });
export type UnitUnitIdParams = StaticDecode<typeof UnitUnitIdParams>;
export const UnitLocalizationParams = t.Object({
	type: ManageableUnitType,
	unitId: t.String({ format: "uuid" }),
	language: ContentLanguage,
});
export type UnitLocalizationParams = StaticDecode<typeof UnitLocalizationParams>;

export const UnitLocalizationBody = t.Object(
	{ ...UnitLocalizationContentFields, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
export type UnitLocalizationBody = StaticDecode<typeof UnitLocalizationBody>;

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
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UnitLocalizationOrderBody = StaticDecode<typeof UnitLocalizationOrderBody>;
export const UnitLocalizationDeleteBody = t.Object(
	{ expectedLanguages: ContentLanguageOrder, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
export type UnitLocalizationDeleteBody = StaticDecode<typeof UnitLocalizationDeleteBody>;
export const UnitLocalizationOrderResponse = t.Object({
	languages: ContentLanguageOrder,
});

export const UnitReferenceResponse = t.Object(
	{ owner: t.UnionEnum(UnitOwnerValues), id: Uuid, shape: t.String() },
	{ additionalProperties: false },
);

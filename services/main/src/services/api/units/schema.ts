import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { ContentLanguageValues } from "@rezics/i18n";
import {
	CreditAttributionRoleValues,
	ContentLanguageEvidenceSourceValues,
	UnitOwnershipModeValues,
	ContentGovernanceActionKindValues,
	MaximumAudioTracksPerVideo,
	MaximumContentLanguageEvidencePageSize,
	MaximumSubjectAssociationsPageSize,
	RealmUnitPublicationStateValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";

import {
	DateTime,
	FractionalPosition,
	ContentLanguage,
	ContentLanguageSupport,
	ContentRating,
	LifecycleInput,
	LocalizationLanguageQuery,
	RevisionContext,
	UnitLocalizationContentFields,
	UnitLocalizationInput,
	Uuid,
	WorkReleaseStatus,
} from "../schema";
import { InitialTagApplicationLimit } from "../../tags/initial-applications";
import { PublicUnitSeoKinds } from "../../units/seo-contract";

export const VariantUnitType = t.Union([
	t.Literal("book"),
	t.Literal("software"),
	t.Literal("media"),
]);
export type VariantUnitType = StaticDecode<typeof VariantUnitType>;

export const WorkUnitType = t.Union([VariantUnitType, t.Literal("series")]);
export type WorkUnitType = StaticDecode<typeof WorkUnitType>;
export const TimedMediaUnitType = t.Union([t.Literal("video"), t.Literal("audio")]);
export type TimedMediaUnitType = StaticDecode<typeof TimedMediaUnitType>;
export const ReleaseUnitType = t.Literal("release");
export type ReleaseUnitType = StaticDecode<typeof ReleaseUnitType>;
export const ManageableUnitType = t.Union([WorkUnitType, TimedMediaUnitType, ReleaseUnitType]);
export type ManageableUnitType = StaticDecode<typeof ManageableUnitType>;
export const ContentLanguageSupportUnitType = t.Union([
	VariantUnitType,
	TimedMediaUnitType,
	ReleaseUnitType,
]);
export type ContentLanguageSupportUnitType = StaticDecode<typeof ContentLanguageSupportUnitType>;
export const ContentLanguageEvidenceUnitType = t.Union([
	VariantUnitType,
	TimedMediaUnitType,
	ReleaseUnitType,
]);

export const VariantUnitTypeParams = t.Object({ type: VariantUnitType });
export const WorkUnitTypeParams = t.Object({ type: WorkUnitType });
export const ManageableUnitTypeParams = t.Object({ type: ManageableUnitType });
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
					source: t.UnionEnum(ContentLanguageEvidenceSourceValues),
					unit: t.Object(
						{
							id: Uuid,
							kind: t.UnionEnum(["book", "software", "media", "video", "audio", "release"]),
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

export const UnitOwnershipMode = t.Union(UnitOwnershipModeValues.map((value) => t.Literal(value)));
export type UnitOwnershipMode = StaticDecode<typeof UnitOwnershipMode>;

export const CreateUnitCreditAttributionInput = t.Object(
	{
		entityId: Uuid,
		role: t.Union(CreditAttributionRoleValues.map((role) => t.Literal(role))),
	},
	{ additionalProperties: false },
);
export type CreateUnitCreditAttributionInput = StaticDecode<
	typeof CreateUnitCreditAttributionInput
>;

export const UnitVersionInput = t.Union([
	t.Object({ kind: t.Literal("main") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("variant"), mainUnitId: Uuid }, { additionalProperties: false }),
]);
export type UnitVersionInput = StaticDecode<typeof UnitVersionInput>;

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
export const UnitSeriesMembershipQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
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

const CreateUnitFields = {
	initialTagIds: t.Optional(
		t.Array(Uuid, { maxItems: InitialTagApplicationLimit, uniqueItems: true, default: [] }),
	),
	creditAttributionRequestConsent: t.Union([t.Literal("direct_only"), t.Literal("allow_requests")]),
	version: UnitVersionInput,
	localization: UnitLocalizationInput,
	contentLanguageSupport: t.Optional(ContentLanguageSupport),
	visibility: LifecycleInput.visibility,
	contentRating: LifecycleInput.contentRating,
	aiDisclosure: LifecycleInput.aiDisclosure,
	licenses: LifecycleInput.licenses,
	details: t.Union([
		t.Object(
			{
				type: t.Literal("book"),
				releaseStatus: WorkReleaseStatus,
				metadataOnly: t.Optional(t.Boolean()),
			},
			{ additionalProperties: false },
		),
		t.Object(
			{ type: t.Literal("software"), metadataOnly: t.Optional(t.Boolean()) },
			{ additionalProperties: false },
		),
		t.Object(
			{
				type: t.Literal("media"),
				releaseStatus: WorkReleaseStatus,
				metadataOnly: t.Optional(t.Boolean()),
			},
			{ additionalProperties: false },
		),
	]),
} as const;

export const CreateUnitBody = t.Union([
	t.Object(
		{
			ownershipMode: t.Literal("profile_owned"),
			creditAttributions: t.Array(CreateUnitCreditAttributionInput, {
				uniqueItems: true,
			}),
			...CreateUnitFields,
			revisionContext: t.Optional(RevisionContext),
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
			revisionContext: t.Optional(RevisionContext),
		},
		{ additionalProperties: false },
	),
]);
export type CreateUnitBody = StaticDecode<typeof CreateUnitBody>;

const UnitDetailsInput = t.Object(
	{
		isbn13: t.Optional(t.Nullable(t.String({ pattern: "^[0-9]{13}$" }))),
		publicationDate: t.Optional(t.Nullable(t.String({ format: "date" }))),
		pageCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		wordCount: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
		metadataOnly: t.Optional(t.Boolean()),
		versionLabel: t.Optional(t.Nullable(t.String())),
		kind: t.Optional(t.String({ minLength: 1 })),
		runtimeMinutes: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		episodeCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		seasonCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		durationSeconds: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		adaptedAudioUnitIds: t.Optional(
			t.Nullable(
				t.Array(Uuid, {
					maxItems: MaximumAudioTracksPerVideo,
					uniqueItems: true,
				}),
			),
		),
		releaseStatus: t.Optional(WorkReleaseStatus),
	},
	{ additionalProperties: false },
);

export const UpdateUnitBody = t.Object(
	{
		updatedAt: t.String({ format: "date-time" }),
		bookChapterDraftScope: t.Optional(
			t.Union([t.Literal("book_only"), t.Literal("manageable_published_chapters")]),
		),
		...LifecycleInput,
		contentLanguageSupport: t.Optional(ContentLanguageSupport),
		unit: t.Optional(
			t.Object(
				{
					releasedOn: t.Optional(t.Nullable(t.String({ format: "date" }))),
				},
				{ additionalProperties: false },
			),
		),
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

export const BookChapterDraftJobParams = t.Object({ bookId: Uuid });
export const CreateBookChapterDraftJobBody = t.Object(
	{ bookUpdatedAt: DateTime },
	{ additionalProperties: false },
);
export const BookChapterDraftJobResponse = t.Object(
	{
		id: Uuid,
		state: t.Union([t.Literal("pending"), t.Literal("completed")]),
	},
	{ additionalProperties: false },
);
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
		{ kind: t.Literal("entity"), entityKind: t.String({ minLength: 1 }) },
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
		language: ContentLanguage,
		title: t.String({ minLength: 1, maxLength: 500 }),
		description: t.Nullable(t.String({ maxLength: 600 })),
		image: t.Nullable(t.Object({ id: Uuid, url: t.String() })),
		context: t.Nullable(PublicUnitSeoContextResponse),
	},
	{ additionalProperties: false },
);
const PublicUnitSeoIdentityResponse = {
	id: Uuid,
	kind: t.UnionEnum(PublicUnitSeoKinds),
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
export const VariantUnitUnitIdParams = t.Object({ type: VariantUnitType, unitId: Uuid });

export const UpdateUnitVariantContextBody = t.Object(
	{
		mainUnitId: t.Nullable(Uuid),
		expectedMainUnitId: t.Nullable(Uuid),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UpdateUnitVariantContextBody = StaticDecode<typeof UpdateUnitVariantContextBody>;

export const PromoteUnitVariantBody = t.Object(
	{ expectedMainUnitId: Uuid, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
export type PromoteUnitVariantBody = StaticDecode<typeof PromoteUnitVariantBody>;

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

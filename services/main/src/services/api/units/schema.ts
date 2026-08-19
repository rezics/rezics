import { type Static, t } from "elysia";
import { ContentLanguageValues } from "@rezics/i18n";
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
		...LocalizationLanguageQuery,
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
	visibility: LifecycleInput.visibility,
	contentRating: LifecycleInput.contentRating,
	aiDisclosure: LifecycleInput.aiDisclosure,
	licenses: LifecycleInput.licenses,
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
export type CreateUnitBody = Static<typeof CreateUnitBody>;

const UnitDetailsInput = t.Object(
	{
		isbn13: t.Optional(t.Nullable(t.String({ pattern: "^[0-9]{13}$" }))),
		publicationDate: t.Optional(t.Nullable(t.String({ format: "date" }))),
		pageCount: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
		wordCount: t.Optional(t.Nullable(t.Integer({ minimum: 0 }))),
		format: t.Optional(t.Nullable(t.String())),
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
		bookChapterDraftScope: t.Optional(
			t.Union([t.Literal("book_only"), t.Literal("manageable_published_chapters")]),
		),
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
		revisionContext: t.Optional(RevisionContext),
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
export type UnitDetailQuery = Static<typeof UnitDetailQuery>;

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
export type UnitUnitIdParams = Static<typeof UnitUnitIdParams>;
export const VariantUnitUnitIdParams = t.Object({ type: VariantUnitType, unitId: Uuid });

export const UpdateUnitVariantContextBody = t.Object(
	{
		mainUnitId: t.Nullable(Uuid),
		expectedMainUnitId: t.Nullable(Uuid),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UpdateUnitVariantContextBody = Static<typeof UpdateUnitVariantContextBody>;

export const PromoteUnitVariantBody = t.Object(
	{ expectedMainUnitId: Uuid, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
export type PromoteUnitVariantBody = Static<typeof PromoteUnitVariantBody>;

export const UnitLocalizationParams = t.Object({
	type: ManageableUnitType,
	unitId: t.String({ format: "uuid" }),
	language: ContentLanguage,
});
export type UnitLocalizationParams = Static<typeof UnitLocalizationParams>;

export const UnitLocalizationBody = t.Object(
	{ ...UnitLocalizationContentFields, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
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
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UnitLocalizationOrderBody = Static<typeof UnitLocalizationOrderBody>;
export const UnitLocalizationDeleteBody = t.Object(
	{ expectedLanguages: ContentLanguageOrder, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
export type UnitLocalizationDeleteBody = Static<typeof UnitLocalizationDeleteBody>;
export const UnitLocalizationOrderResponse = t.Object({
	languages: ContentLanguageOrder,
});

import type { StaticDecode } from "typebox";
import { t } from "elysia";

import {
	AliasKindValues,
	CreditAttributionUnitKindValues,
	CreditAttributionRoleValues,
	EntityKindValues,
	SubjectAssociationRoleValues,
	UnitReferencePageDefault,
	UnitReferencePageMaximum,
	UnitKindValues,
} from "../../database/schema/contract-values";
import {
	DateTime,
	FractionalPositionInput,
	ContentLanguage,
	LocalizationLanguageQuery,
	RevisionContext,
	UnitLocalizationInput,
	Uuid,
} from "../schema";
import { UnitOwnershipMode, WorkUnitType } from "../units/schema";

export const CreateUnitResourceBody = t.Object(
	{
		kind: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
		localization: UnitLocalizationInput,
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type CreateUnitResourceBody = StaticDecode<typeof CreateUnitResourceBody>;

export const CreateEntityBody = t.Object(
	{
		ownershipMode: UnitOwnershipMode,
		kind: t.Optional(t.UnionEnum(EntityKindValues, { default: undefined })),
		localization: UnitLocalizationInput,
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type CreateEntityBody = StaticDecode<typeof CreateEntityBody>;

export const ListEntityEntriesQuery = t.Object(
	{
		creditAttributionSearch: t.Optional(t.Union([t.Literal("direct"), t.Literal("public")])),
		kind: t.Optional(t.UnionEnum(EntityKindValues, { default: undefined })),
		query: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListEntityEntriesQuery = StaticDecode<typeof ListEntityEntriesQuery>;

export const EntityDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type EntityDetailQuery = StaticDecode<typeof EntityDetailQuery>;

const MeasurementValue = t.Nullable(t.Integer({ minimum: 1, maximum: 2_147_483_647 }));

export const UpsertEntityMeasurementBody = t.Object(
	{
		contextUnitId: t.Optional(t.Nullable(Uuid)),
		heightMillimetres: MeasurementValue,
		weightGrams: MeasurementValue,
		bustMillimetres: MeasurementValue,
		waistMillimetres: MeasurementValue,
		hipsMillimetres: MeasurementValue,
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type UpsertEntityMeasurementBody = StaticDecode<typeof UpsertEntityMeasurementBody>;

export const EntityLocalizationParams = t.Object({ unitId: Uuid, language: ContentLanguage });
export type EntityLocalizationParams = StaticDecode<typeof EntityLocalizationParams>;

export const ListTagsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListTagsQuery = StaticDecode<typeof ListTagsQuery>;

export const TagDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type TagDetailQuery = StaticDecode<typeof TagDetailQuery>;

export const TagDetailParams = t.Object({ tagId: Uuid });
export type TagDetailParams = StaticDecode<typeof TagDetailParams>;

export const TagLocalizationParams = t.Object({ tagId: Uuid, language: ContentLanguage });
export type TagLocalizationParams = StaticDecode<typeof TagLocalizationParams>;

export const AddUnitCreditBody = t.Object(
	{
		creditedUnitId: Uuid,
		role: t.UnionEnum(CreditAttributionRoleValues),
		position: t.Optional(FractionalPositionInput),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type AddUnitCreditBody = StaticDecode<typeof AddUnitCreditBody>;

export const AddUnitSubjectAssociationBody = t.Object(
	{
		entityId: Uuid,
		contextPostId: t.Optional(Uuid),
		role: t.UnionEnum(SubjectAssociationRoleValues),
		position: t.Optional(FractionalPositionInput),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type AddUnitSubjectAssociationBody = StaticDecode<typeof AddUnitSubjectAssociationBody>;

export const SubjectAssociationSpoilerBody = t.Object(
	{ spoilerLevel: t.Union([t.Literal(0), t.Literal(1), t.Literal(2)]) },
	{ additionalProperties: false },
);
export type SubjectAssociationSpoilerBody = StaticDecode<typeof SubjectAssociationSpoilerBody>;

export const AddUnitExternalLinkBody = t.Object(
	{
		url: t.String({
			format: "uri",
			pattern: "^[Hh][Tt][Tt][Pp][Ss]?://",
		}),
		sourceEntityId: Uuid,
	},
	{ additionalProperties: false },
);
export type AddUnitExternalLinkBody = StaticDecode<typeof AddUnitExternalLinkBody>;

export const UnitUnitParams = t.Object({ type: WorkUnitType, unitId: Uuid });
export type UnitUnitParams = StaticDecode<typeof UnitUnitParams>;

export const AttributionUnitType = t.UnionEnum(CreditAttributionUnitKindValues);
export type AttributionUnitType = StaticDecode<typeof AttributionUnitType>;

/** Unit kinds currently exposed through the generic Tag landscape and curation APIs. */
export const TaggableUnitType = t.Union([WorkUnitType, t.Literal("entity")]);
export type TaggableUnitType = StaticDecode<typeof TaggableUnitType>;

export const AttributionUnitParams = t.Object({
	type: AttributionUnitType,
	unitId: Uuid,
});
export type AttributionUnitParams = StaticDecode<typeof AttributionUnitParams>;

export const AttributionAssociationParams = t.Object({
	type: AttributionUnitType,
	unitId: Uuid,
	associationId: Uuid,
});
export type AttributionAssociationParams = StaticDecode<typeof AttributionAssociationParams>;

export const UnitAssociationParams = t.Object({
	type: WorkUnitType,
	unitId: Uuid,
	associationId: Uuid,
});
export type UnitAssociationParams = StaticDecode<typeof UnitAssociationParams>;

export const UnitExternalLinkUnitParams = t.Object({
	type: t.Union(UnitKindValues.map((value) => t.Literal(value))),
	unitId: Uuid,
});
export type UnitExternalLinkUnitParams = StaticDecode<typeof UnitExternalLinkUnitParams>;

const UnitReferencePaginationQuery = {
	cursor: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
	limit: t.Optional(
		t.Integer({
			minimum: 1,
			maximum: UnitReferencePageMaximum,
			default: UnitReferencePageDefault,
		}),
	),
};

export const UnitExternalLinkListQuery = t.Object(
	{ ...LocalizationLanguageQuery, ...UnitReferencePaginationQuery },
	{ additionalProperties: false },
);
export type UnitExternalLinkListQuery = StaticDecode<typeof UnitExternalLinkListQuery>;

export const UnitExternalLinkParams = t.Object({
	...UnitExternalLinkUnitParams.properties,
	externalLinkId: Uuid,
});
export type UnitExternalLinkParams = StaticDecode<typeof UnitExternalLinkParams>;

export const UnitTagParams = t.Object({ type: TaggableUnitType, unitId: Uuid, tagId: Uuid });
export type UnitTagParams = StaticDecode<typeof UnitTagParams>;

export const TagUnitBody = t.Object({}, { additionalProperties: false });
export type TagUnitBody = StaticDecode<typeof TagUnitBody>;

export const UpdateUnitTagCurationBody = t.Union([
	t.Object(
		{
			pinned: t.Literal(true),
			position: FractionalPositionInput,
			updatedAt: DateTime,
			expectedFeaturedTagIds: t.Array(Uuid),
			revisionContext: t.Optional(RevisionContext),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			pinned: t.Literal(false),
			position: t.Null(),
			updatedAt: DateTime,
			expectedFeaturedTagIds: t.Array(Uuid),
			revisionContext: t.Optional(RevisionContext),
		},
		{ additionalProperties: false },
	),
]);
export type UpdateUnitTagCurationBody = StaticDecode<typeof UpdateUnitTagCurationBody>;

export const AddUnitAliasBody = t.Object(
	{
		term: t.String({ minLength: 1, maxLength: 500 }),
		language: t.Optional(ContentLanguage),
		kind: t.Optional(t.Union(AliasKindValues.map((value) => t.Literal(value)))),
	},
	{ additionalProperties: false },
);
export type AddUnitAliasBody = StaticDecode<typeof AddUnitAliasBody>;

export const UnitAliasUnitParams = t.Object({
	type: t.Union(UnitKindValues.map((value) => t.Literal(value))),
	unitId: Uuid,
});
export type UnitAliasUnitParams = StaticDecode<typeof UnitAliasUnitParams>;

export const UnitAliasListQuery = t.Object(UnitReferencePaginationQuery, {
	additionalProperties: false,
});
export type UnitAliasListQuery = StaticDecode<typeof UnitAliasListQuery>;

export const UnitAliasParams = t.Object({
	type: t.Union(UnitKindValues.map((value) => t.Literal(value))),
	unitId: Uuid,
	aliasId: Uuid,
});
export type UnitAliasParams = StaticDecode<typeof UnitAliasParams>;

export const UpdateUnitReferenceCurationBody = t.Union([
	t.Object(
		{
			baseVersion: t.Integer({ minimum: 0 }),
			pinned: t.Literal(true),
			position: FractionalPositionInput,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			baseVersion: t.Integer({ minimum: 0 }),
			pinned: t.Literal(false),
			position: t.Null(),
		},
		{ additionalProperties: false },
	),
]);
export type UpdateUnitReferenceCurationBody = StaticDecode<typeof UpdateUnitReferenceCurationBody>;

export const WithdrawUnitReferenceQuery = t.Object(
	{ baseVersion: t.Integer({ minimum: 0 }) },
	{ additionalProperties: false },
);
export type WithdrawUnitReferenceQuery = StaticDecode<typeof WithdrawUnitReferenceQuery>;

export const VoteBody = t.Object(
	{ value: t.Union([t.Literal(-1), t.Literal(1)]) },
	{ additionalProperties: false },
);
export type VoteBody = StaticDecode<typeof VoteBody>;

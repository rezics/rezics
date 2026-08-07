import { type Static, t } from "elysia";

import {
	AliasKindValues,
	CreditAttributionRoleValues,
	EntityKindValues,
	SubjectAssociationRoleValues,
	UnitKindValues,
} from "../../database/schema/contract-values";
import {
	DateTime,
	FractionalPosition,
	ContentLanguage,
	LocalizationLanguageQuery,
	LocalizationInput,
	Uuid,
} from "../schema";
import { UnitOwnershipMode, WorkUnitType } from "../units/schema";

export const CreateUnitResourceBody = t.Object(
	{
		kind: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export type CreateUnitResourceBody = Static<typeof CreateUnitResourceBody>;

export const CreateEntityBody = t.Object(
	{
		ownershipMode: UnitOwnershipMode,
		kind: t.Optional(t.UnionEnum(EntityKindValues, { default: undefined })),
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export type CreateEntityBody = Static<typeof CreateEntityBody>;

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
export type ListEntityEntriesQuery = Static<typeof ListEntityEntriesQuery>;

export const EntityDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type EntityDetailQuery = Static<typeof EntityDetailQuery>;

export const EntityLocalizationParams = t.Object({ unitId: Uuid, language: ContentLanguage });
export type EntityLocalizationParams = Static<typeof EntityLocalizationParams>;

export const ListTagsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListTagsQuery = Static<typeof ListTagsQuery>;

export const TagDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type TagDetailQuery = Static<typeof TagDetailQuery>;

export const TagDetailParams = t.Object({ tagId: Uuid });
export type TagDetailParams = Static<typeof TagDetailParams>;

export const TagLocalizationParams = t.Object({ tagId: Uuid, language: ContentLanguage });
export type TagLocalizationParams = Static<typeof TagLocalizationParams>;

export const AddUnitCreditBody = t.Object({
	creditedUnitId: Uuid,
	role: t.UnionEnum(CreditAttributionRoleValues),
	position: t.Optional(FractionalPosition),
});
export type AddUnitCreditBody = Static<typeof AddUnitCreditBody>;

export const AddUnitSubjectAssociationBody = t.Object(
	{
		entityId: Uuid,
		contextPostId: t.Optional(Uuid),
		role: t.UnionEnum(SubjectAssociationRoleValues),
		position: t.Optional(FractionalPosition),
	},
	{ additionalProperties: false },
);
export type AddUnitSubjectAssociationBody = Static<typeof AddUnitSubjectAssociationBody>;

export const AddUnitLinkBody = t.Object(
	{
		url: t.String({
			format: "uri",
			pattern: "^[Hh][Tt][Tt][Pp][Ss]?://",
		}),
		sourceEntityUnitId: Uuid,
	},
	{ additionalProperties: false },
);
export type AddUnitLinkBody = Static<typeof AddUnitLinkBody>;

export const UnitUnitParams = t.Object({ type: WorkUnitType, unitId: Uuid });
export type UnitUnitParams = Static<typeof UnitUnitParams>;

export const AttributionUnitType = t.Union([WorkUnitType, t.Literal("entity")]);
export type AttributionUnitType = Static<typeof AttributionUnitType>;

export const AttributionUnitParams = t.Object({
	type: AttributionUnitType,
	unitId: Uuid,
});
export type AttributionUnitParams = Static<typeof AttributionUnitParams>;

export const AttributionAssociationParams = t.Object({
	type: AttributionUnitType,
	unitId: Uuid,
	associationId: Uuid,
});
export type AttributionAssociationParams = Static<typeof AttributionAssociationParams>;

export const UnitAssociationParams = t.Object({
	type: WorkUnitType,
	unitId: Uuid,
	associationId: Uuid,
});
export type UnitAssociationParams = Static<typeof UnitAssociationParams>;

export const UnitSourceLinkUnitParams = t.Object({
	type: t.Union(UnitKindValues.map((value) => t.Literal(value))),
	unitId: Uuid,
});
export type UnitSourceLinkUnitParams = Static<typeof UnitSourceLinkUnitParams>;

export const UnitSourceLinkListQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type UnitSourceLinkListQuery = Static<typeof UnitSourceLinkListQuery>;

export const UnitSourceLinkParams = t.Object({
	...UnitSourceLinkUnitParams.properties,
	linkId: Uuid,
});
export type UnitSourceLinkParams = Static<typeof UnitSourceLinkParams>;

export const UnitTagParams = t.Object({ type: WorkUnitType, unitId: Uuid, tagId: Uuid });
export type UnitTagParams = Static<typeof UnitTagParams>;

export const TagUnitBody = t.Object({}, { additionalProperties: false });
export type TagUnitBody = Static<typeof TagUnitBody>;

export const UpdateUnitTagCurationBody = t.Union([
	t.Object(
		{
			pinned: t.Literal(true),
			position: FractionalPosition,
			updatedAt: DateTime,
			expectedFeaturedTagIds: t.Array(Uuid),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			pinned: t.Literal(false),
			position: t.Null(),
			updatedAt: DateTime,
			expectedFeaturedTagIds: t.Array(Uuid),
		},
		{ additionalProperties: false },
	),
]);
export type UpdateUnitTagCurationBody = Static<typeof UpdateUnitTagCurationBody>;

export const AddUnitAliasBody = t.Object(
	{
		term: t.String({ minLength: 1, maxLength: 500 }),
		language: t.Optional(ContentLanguage),
		kind: t.Optional(t.Union(AliasKindValues.map((value) => t.Literal(value)))),
	},
	{ additionalProperties: false },
);
export type AddUnitAliasBody = Static<typeof AddUnitAliasBody>;

export const UnitAliasUnitParams = t.Object({
	type: t.Union(UnitKindValues.map((value) => t.Literal(value))),
	unitId: Uuid,
});
export type UnitAliasUnitParams = Static<typeof UnitAliasUnitParams>;

export const UnitAliasParams = t.Object({
	type: t.Union(UnitKindValues.map((value) => t.Literal(value))),
	unitId: Uuid,
	aliasId: Uuid,
});
export type UnitAliasParams = Static<typeof UnitAliasParams>;

export const UpdateUnitReferenceCurationBody = t.Union([
	t.Object(
		{
			baseVersion: t.Integer({ minimum: 0 }),
			pinned: t.Literal(true),
			position: FractionalPosition,
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
export type UpdateUnitReferenceCurationBody = Static<typeof UpdateUnitReferenceCurationBody>;

export const VoteBody = t.Object(
	{ value: t.Union([t.Literal(-1), t.Literal(1)]) },
	{ additionalProperties: false },
);
export type VoteBody = Static<typeof VoteBody>;

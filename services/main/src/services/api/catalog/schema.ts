import { type Static, t } from "elysia";

import {
	AliasKindValues,
	CreditAttributionRoleValues,
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
import { CatalogEntryMode, CatalogUnitType, VariantUnitType } from "../units/schema";

export const CreateCatalogUnitBody = t.Object(
	{
		kind: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export type CreateCatalogUnitBody = Static<typeof CreateCatalogUnitBody>;

export const CreateEntityBody = t.Object(
	{
		catalogMode: CatalogEntryMode,
		kind: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export type CreateEntityBody = Static<typeof CreateEntityBody>;

export const ListEntityEntriesQuery = t.Object(
	{
		kind: t.Optional(t.String({ maxLength: 64 })),
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

export const AddUnitLinkBody = t.Object({
	url: t.String({ format: "uri" }),
	sourceEntityUnitId: Uuid,
	role: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
	position: t.Optional(FractionalPosition),
});
export type AddUnitLinkBody = Static<typeof AddUnitLinkBody>;

export const UnitUnitParams = t.Object({ type: CatalogUnitType, unitId: Uuid });
export type UnitUnitParams = Static<typeof UnitUnitParams>;

export const AttributionUnitType = t.Union([CatalogUnitType, t.Literal("entity")]);
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
	type: CatalogUnitType,
	unitId: Uuid,
	associationId: Uuid,
});
export type UnitAssociationParams = Static<typeof UnitAssociationParams>;

export const UnitTagParams = t.Object({ type: CatalogUnitType, unitId: Uuid, tagId: Uuid });
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

export const VoteBody = t.Object(
	{ value: t.Union([t.Literal(-1), t.Literal(1)]) },
	{ additionalProperties: false },
);
export type VoteBody = Static<typeof VoteBody>;

export const UnitVersionParams = t.Object({
	type: VariantUnitType,
	unitId: Uuid,
	canonicalId: Uuid,
});
export type UnitVersionParams = Static<typeof UnitVersionParams>;

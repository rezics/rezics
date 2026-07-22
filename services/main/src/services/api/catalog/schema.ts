import { type Static, t } from "elysia";

import {
	AliasKindValues,
	EntityAssociationPolicyModeValues,
	UnitKindValues,
} from "../../database/schema/contract-values";
import { FractionalPosition, ContentLanguage, LocalizationInput, Uuid } from "../schema";
import { CatalogUnitType, VariantUnitType } from "../units/schema";

export const CreateCatalogUnitBody = t.Object(
	{
		kind: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export type CreateCatalogUnitBody = Static<typeof CreateCatalogUnitBody>;

export const ListEntityEntriesQuery = t.Object({
	kind: t.Optional(t.String({ maxLength: 64 })),
	language: t.Optional(ContentLanguage),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListEntityEntriesQuery = Static<typeof ListEntityEntriesQuery>;

export const EntityDetailQuery = t.Object({ language: t.Optional(ContentLanguage) });
export type EntityDetailQuery = Static<typeof EntityDetailQuery>;

export const EntityLocalizationParams = t.Object({ unitId: Uuid, language: ContentLanguage });
export type EntityLocalizationParams = Static<typeof EntityLocalizationParams>;

export const ListTagsQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListTagsQuery = Static<typeof ListTagsQuery>;

export const AddUnitCreditBody = t.Object({
	creditedUnitId: Uuid,
	role: t.String({ minLength: 1, maxLength: 64 }),
	position: t.Optional(FractionalPosition),
});
export type AddUnitCreditBody = Static<typeof AddUnitCreditBody>;

export const AddUnitSubjectAssociationBody = t.Object(
	{
		entityId: Uuid,
		role: t.String({ minLength: 1, maxLength: 64 }),
		position: t.Optional(FractionalPosition),
	},
	{ additionalProperties: false },
);
export type AddUnitSubjectAssociationBody = Static<typeof AddUnitSubjectAssociationBody>;

const EntityAssociationPolicyMode = t.UnionEnum(EntityAssociationPolicyModeValues);
export const UpdateEntityAssociationPolicyBody = t.Object(
	{
		creditAttribution: t.Optional(EntityAssociationPolicyMode),
		subjectAssociation: t.Optional(EntityAssociationPolicyMode),
	},
	{ additionalProperties: false, minProperties: 1 },
);
export type UpdateEntityAssociationPolicyBody = Static<typeof UpdateEntityAssociationPolicyBody>;

export const AddUnitLinkBody = t.Object({
	url: t.String({ format: "uri" }),
	sourceEntityUnitId: Uuid,
	role: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
	position: t.Optional(FractionalPosition),
});
export type AddUnitLinkBody = Static<typeof AddUnitLinkBody>;

export const UnitUnitParams = t.Object({ type: CatalogUnitType, unitId: Uuid });
export type UnitUnitParams = Static<typeof UnitUnitParams>;

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

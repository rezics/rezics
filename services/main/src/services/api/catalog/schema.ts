import { type Static, t } from "elysia";

import { AliasKindValues } from "../../database/schema/contract-values";
import { LocalizationInput, Uuid } from "../schema";
import { UnitType } from "../units/schema";

export const CreateCatalogUnitBody = t.Object(
	{
		kind: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
		slug: t.Optional(t.String({ minLength: 3, maxLength: 72 })),
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export type CreateCatalogUnitBody = Static<typeof CreateCatalogUnitBody>;

export const ListEntityEntriesQuery = t.Object({
	kind: t.Optional(t.String({ maxLength: 64 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListEntityEntriesQuery = Static<typeof ListEntityEntriesQuery>;

export const ListTagsQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListTagsQuery = Static<typeof ListTagsQuery>;

export const AddUnitCreditBody = t.Object({
	entityId: Uuid,
	role: t.String({ minLength: 1, maxLength: 64 }),
	position: t.Optional(t.String({ maxLength: 64 })),
});
export type AddUnitCreditBody = Static<typeof AddUnitCreditBody>;

export const AddUnitLinkBody = t.Object({
	url: t.String({ format: "uri" }),
	sourceEntityUnitId: Uuid,
	role: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
	label: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
	position: t.Optional(t.String({ maxLength: 64 })),
});
export type AddUnitLinkBody = Static<typeof AddUnitLinkBody>;

export const UnitUnitParams = t.Object({ type: UnitType, unitId: Uuid });
export type UnitUnitParams = Static<typeof UnitUnitParams>;

export const UnitTagParams = t.Object({ type: UnitType, unitId: Uuid, tagId: Uuid });
export type UnitTagParams = Static<typeof UnitTagParams>;

export const TagUnitBody = t.Object({}, { additionalProperties: false });
export type TagUnitBody = Static<typeof TagUnitBody>;

export const AddUnitAliasBody = t.Object(
	{
		value: t.String({ minLength: 1, maxLength: 500 }),
		language: t.Optional(t.String({ minLength: 2, maxLength: 35 })),
		kind: t.Optional(t.Union(AliasKindValues.map((value) => t.Literal(value)))),
		pinned: t.Optional(t.Boolean()),
		position: t.Optional(t.String({ maxLength: 64 })),
	},
	{ additionalProperties: false },
);
export type AddUnitAliasBody = Static<typeof AddUnitAliasBody>;

export const UnitAliasParams = t.Object({
	type: UnitType,
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
	type: UnitType,
	unitId: Uuid,
	canonicalId: Uuid,
});
export type UnitVersionParams = Static<typeof UnitVersionParams>;

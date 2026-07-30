import { inArray, sql } from "drizzle-orm";
import { check, foreignKey, index, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { type VariantCapableUnitKind, VariantCapableUnitKindValues } from "./contract-values";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./unit";

export const unitVariant = pgTable(
	"unit_variant",
	{
		variantUnitId: uuid().primaryKey(),
		mainUnitId: uuid().notNull(),
		unitKind: text().$type<VariantCapableUnitKind>().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.variantUnitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_variant_variant_kind_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.mainUnitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_variant_main_kind_fkey",
		}).onDelete("restrict"),
		index("unit_variant_main_created_at_idx").on(
			table.mainUnitId,
			table.createdAt,
			table.variantUnitId,
		),
		check("unit_variant_kind_check", inArray(table.unitKind, VariantCapableUnitKindValues)),
		check("unit_variant_not_self_check", sql`${table.variantUnitId} <> ${table.mainUnitId}`),
	],
);

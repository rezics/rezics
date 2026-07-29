import { sql } from "drizzle-orm";
import { check, foreignKey, index, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn, fractionalIndexPosition } from "./columns";
import { profile, unit } from "./core";

/**
 * Marks a Unit as a stored, explicitly ordered Collection.
 *
 * Dynamic Collections are intentionally not represented here. If query-backed
 * Collections are introduced, they must use a separate model whose membership
 * and ordering semantics cannot be confused with stored Collection items.
 */
export const collection = pgTable("collection", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
});

export const profileFavoritesCollection = pgTable(
	"profile_favorites_collection",
	{
		profileId: uuid()
			.primaryKey()
			.references(() => profile.id, { onDelete: "cascade" }),
		collectionId: uuid()
			.notNull()
			.references(() => collection.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [unique("profile_favorites_collection_collection_id_unique").on(table.collectionId)],
);

export const collectionItem = pgTable(
	"collection_item",
	{
		collectionId: uuid()
			.notNull()
			.references(() => collection.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		parentUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		addedByProfileId: uuid().references(() => profile.id, {
			onDelete: "set null",
		}),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.collectionId, table.unitId] }),
		index("collection_item_collection_position_idx").on(
			table.collectionId,
			table.parentUnitId,
			table.position,
			table.unitId,
		),
		unique("collection_item_sibling_position_unique")
			.on(table.collectionId, table.parentUnitId, table.position)
			.nullsNotDistinct(),
		index("collection_item_unit_idx").on(table.unitId),
		index("collection_item_added_by_idx").on(table.addedByProfileId),
		foreignKey({
			name: "collection_item_parent_membership_fk",
			columns: [table.collectionId, table.parentUnitId],
			foreignColumns: [table.collectionId, table.unitId],
		}),
		check("collection_item_not_self_check", sql`${table.collectionId} <> ${table.unitId}`),
		check(
			"collection_item_parent_not_self_check",
			sql`${table.parentUnitId} is null or ${table.parentUnitId} <> ${table.unitId}`,
		),
	],
);

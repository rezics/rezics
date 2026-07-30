import { sql } from "drizzle-orm";
import { check, index, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn, fractionalIndexPosition } from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";

/**
 * Marks a Unit as a stored, explicitly ordered Collection.
 *
 * @remarks
 *
 * Collection membership is one flat sequence. Domain relationships such as a
 * Review's subject remain authoritative on the member Unit; saving a Review
 * may add its missing subject immediately before it, but does not create a
 * second hierarchy inside the Collection.
 *
 * If richer grouped rendering later proves necessary, an optional parent
 * pointer may be considered as presentation metadata. It should not replace
 * the authoritative domain relationship or make ordinary ordering recursive.
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
			table.position,
			table.unitId,
		),
		unique("collection_item_position_unique").on(table.collectionId, table.position),
		index("collection_item_unit_idx").on(table.unitId),
		index("collection_item_added_by_idx").on(table.addedByProfileId),
		check("collection_item_not_self_check", sql`${table.collectionId} <> ${table.unitId}`),
	],
);

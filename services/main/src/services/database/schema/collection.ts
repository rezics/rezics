import { sql } from "drizzle-orm";
import { check, index, pgEnum, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createJsonDocumentColumn, createUpdatedAtColumn } from "./columns";
import { profile, unit } from "./core";

export const collectionSource = pgEnum("collection_source", ["manual", "dynamic", "system"]);
export const collectionSystemKey = pgEnum("collection_system_key", ["favorites"]);

export const collection = pgTable(
	"collection",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		ownerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		source: collectionSource().default("manual").notNull(),
		systemKey: collectionSystemKey(),
		/** @UNIT_LOCALIZATION_EXEMPT Executable collection membership rules, not display copy. */
		definitionDocument: createJsonDocumentColumn().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Collection layout configuration, not display copy. */
		presentationDocument: createJsonDocumentColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("collection_owner_created_at_idx").on(
			table.ownerProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		uniqueIndex("collection_owner_system_key")
			.on(table.ownerProfileId, table.systemKey)
			.where(sql`${table.source} = 'system'::collection_source`),
		check(
			"collection_source_system_key_check",
			sql`(${table.source} = 'system'::collection_source) = (${table.systemKey} is not null)`,
		),
	],
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
		role: text().default("item").notNull(),
		position: text().default("V").notNull(),
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
		index("collection_item_unit_idx").on(table.unitId),
		index("collection_item_added_by_idx").on(table.addedByProfileId),
		check("collection_item_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check("collection_item_not_self_check", sql`${table.collectionId} <> ${table.unitId}`),
	],
);

import { sql } from "drizzle-orm";
import { check, foreignKey, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { contentRating, unit } from "./core";

/**
 * One occurrence of a content Unit inside an owning Unit's Content Structure.
 *
 * The occurrence ID is the stable structural identity. A content Unit can be
 * reused in multiple nodes without conflating those positions.
 */
export const contentStructureNode = pgTable(
	"content_structure_node",
	{
		id: createUuidv7PrimaryKey(),
		ownerUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		parentId: uuid(),
		contentUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		title: text().notNull(),
		position: text().notNull(),
		contentRating: contentRating(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("content_structure_node_id_owner_key").on(table.id, table.ownerUnitId),
		foreignKey({
			columns: [table.parentId, table.ownerUnitId],
			foreignColumns: [table.id, table.ownerUnitId],
			name: "content_structure_node_parent_owner_fkey",
		}).onDelete("restrict"),
		index("content_structure_node_owner_parent_position_idx")
			.on(table.ownerUnitId, table.parentId, table.position, table.id)
			.where(sql`${table.deletedAt} is null`),
		index("content_structure_node_parent_idx").on(table.parentId),
		index("content_structure_node_content_unit_idx").on(table.contentUnitId),
		check("content_structure_node_title_not_blank", sql`btrim(${table.title}) <> ''`),
		check(
			"content_structure_node_not_self_parent",
			sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
		),
		check(
			"content_structure_node_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

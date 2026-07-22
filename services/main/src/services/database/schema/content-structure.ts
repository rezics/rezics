import { inArray, sql } from "drizzle-orm";
import { type SearchConfiguration } from "@rezics/search";
import {
	check,
	foreignKey,
	index,
	jsonb,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import {
	type ContentStructureKind,
	ContentStructureKindValues,
	type ContentStructureTargetKind,
	ContentStructureTargetKindValues,
} from "./contract-values";
import { contentRating, unit } from "./core";
import { zonePage } from "./zone";

/** A stable Unit-owned ordered-tree resource. */
export const contentStructure = pgTable(
	"content_structure",
	{
		id: createUuidv7PrimaryKey(),
		ownerUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		/** Runtime kind schemas provide the stronger discriminated-union proof. */
		kind: text().$type<ContentStructureKind>().notNull(),
		/** NavigationDocument root key; null for non-navigation structures. */
		documentKey: text(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("content_structure_id_owner_key").on(table.id, table.ownerUnitId),
		uniqueIndex("content_structure_singleton_kind_key")
			.on(table.ownerUnitId, table.kind)
			.where(
				sql`${table.deletedAt} is null and ${table.kind} in ('book.contents', 'post.contents', 'realm.taxonomy')`,
			),
		index("content_structure_owner_kind_idx")
			.on(table.ownerUnitId, table.kind, table.createdAt, table.id)
			.where(sql`${table.deletedAt} is null`),
		check("content_structure_kind_check", inArray(table.kind, ContentStructureKindValues)),
		check(
			"content_structure_document_key_check",
			sql`${table.documentKey} is null or ${table.documentKey} ~ '^[0-9a-f]{12}$'`,
		),
		check(
			"content_structure_navigation_document_key_check",
			sql`(${table.kind} in ('realm.navigation', 'zone.navigation')) = (${table.documentKey} is not null)`,
		),
		check(
			"content_structure_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

/**
 * One stable occurrence of a content Unit inside a Content Structure.
 *
 * `contentUnitId` is the semantic/display payload. Navigation destinations are
 * represented separately by the target discriminant and its proven shape.
 */
export const contentStructureNode = pgTable(
	"content_structure_node",
	{
		id: createUuidv7PrimaryKey(),
		structureId: uuid().notNull(),
		ownerUnitId: uuid().notNull(),
		parentId: uuid(),
		contentUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		documentKey: text(),
		targetKind: text().$type<ContentStructureTargetKind>().default("content").notNull(),
		targetUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		targetZonePageId: uuid().references(() => zonePage.id, { onDelete: "restrict" }),
		targetUrl: text(),
		/** Optional trusted query/UI schema for a label-backed dynamic branch. */
		searchConfiguration: jsonb().$type<SearchConfiguration>(),
		position: fractionalIndexPosition().notNull(),
		contentRating: contentRating(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("content_structure_node_id_structure_key").on(table.id, table.structureId),
		unique("content_structure_node_id_owner_key").on(table.id, table.ownerUnitId),
		foreignKey({
			columns: [table.structureId, table.ownerUnitId],
			foreignColumns: [contentStructure.id, contentStructure.ownerUnitId],
			name: "content_structure_node_structure_owner_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.parentId, table.structureId],
			foreignColumns: [table.id, table.structureId],
			name: "content_structure_node_parent_structure_fkey",
		}).onDelete("restrict"),
		uniqueIndex("content_structure_node_document_key")
			.on(table.structureId, table.documentKey)
			.where(sql`${table.documentKey} is not null and ${table.deletedAt} is null`),
		index("content_structure_node_structure_parent_position_idx")
			.on(table.structureId, table.parentId, table.position, table.id)
			.where(sql`${table.deletedAt} is null`),
		index("content_structure_node_owner_idx")
			.on(table.ownerUnitId, table.structureId)
			.where(sql`${table.deletedAt} is null`),
		index("content_structure_node_parent_idx").on(table.parentId),
		index("content_structure_node_content_unit_structure_idx")
			.on(table.contentUnitId, table.structureId)
			.where(sql`${table.deletedAt} is null`),
		index("content_structure_node_target_unit_idx").on(table.targetUnitId),
		index("content_structure_node_target_zone_page_idx").on(table.targetZonePageId),
		check(
			"content_structure_node_not_self_parent",
			sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
		),
		check(
			"content_structure_node_document_key_check",
			sql`${table.documentKey} is null or ${table.documentKey} ~ '^[0-9a-f]{12}$'`,
		),
		check(
			"content_structure_node_target_kind_check",
			inArray(table.targetKind, ContentStructureTargetKindValues),
		),
		check(
			"content_structure_node_target_shape_check",
			sql`(
				${table.targetKind} in ('content', 'none')
				and ${table.targetUnitId} is null
				and ${table.targetZonePageId} is null
				and ${table.targetUrl} is null
			) or (
				${table.targetKind} = 'unit'
				and ${table.targetUnitId} is not null
				and ${table.targetZonePageId} is null
				and ${table.targetUrl} is null
			) or (
				${table.targetKind} = 'zone_page'
				and ${table.targetUnitId} is null
				and ${table.targetZonePageId} is not null
				and ${table.targetUrl} is null
			) or (
				${table.targetKind} = 'external'
				and ${table.targetUnitId} is null
				and ${table.targetZonePageId} is null
				and ${table.targetUrl} ~ '^https://[^[:space:]]+$'
				and char_length(${table.targetUrl}) <= 2000
			)`,
		),
		check(
			"content_structure_node_search_configuration_check",
			sql`${table.searchConfiguration} is null or jsonb_typeof(${table.searchConfiguration}) = 'object'`,
		),
		check(
			"content_structure_node_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

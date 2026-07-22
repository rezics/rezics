import { sql } from "drizzle-orm";
import { check, foreignKey, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { profile } from "./core";
import { unitDock } from "./dock";
import { revisionContent } from "./history";

export const dockRevision = pgTable(
	"dock_revision",
	{
		id: createUuidv7PrimaryKey(),
		dockId: uuid()
			.notNull()
			.references(() => unitDock.id, { onDelete: "restrict" }),
		parentRevisionId: uuid(),
		sourceRevisionId: uuid(),
		contentId: uuid()
			.notNull()
			.references(() => revisionContent.id, { onDelete: "restrict" }),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		/** @UNIT_LOCALIZATION_EXEMPT Authored point-in-time edit summary, never interface copy. */
		editSummary: text(),
		kind: text().$type<"create" | "update" | "delete" | "restore">().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("dock_revision_id_dock_key").on(table.id, table.dockId),
		foreignKey({
			columns: [table.parentRevisionId, table.dockId],
			foreignColumns: [table.id, table.dockId],
			name: "dock_revision_parent_dock_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.sourceRevisionId, table.dockId],
			foreignColumns: [table.id, table.dockId],
			name: "dock_revision_source_dock_fkey",
		}).onDelete("restrict"),
		index("dock_revision_dock_created_at_idx").on(
			table.dockId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("dock_revision_content_idx").on(table.contentId),
		check(
			"dock_revision_kind_check",
			sql`${table.kind} in ('create', 'update', 'delete', 'restore')`,
		),
		check(
			"dock_revision_source_shape_check",
			sql`(${table.kind} = 'restore') = (${table.sourceRevisionId} is not null)`,
		),
	],
);

export const dockRevisionHead = pgTable(
	"dock_revision_head",
	{
		dockId: uuid()
			.primaryKey()
			.references(() => unitDock.id, { onDelete: "cascade" }),
		revisionId: uuid().notNull(),
	},
	(table) => [
		unique("dock_revision_head_revision_key").on(table.revisionId),
		foreignKey({
			columns: [table.revisionId, table.dockId],
			foreignColumns: [dockRevision.id, dockRevision.dockId],
			name: "dock_revision_head_revision_dock_fkey",
		}).onDelete("restrict"),
	],
);

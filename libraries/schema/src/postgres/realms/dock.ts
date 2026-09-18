import { unitReferenceColumns, unitReferenceConstraints } from "../shared/unit-reference-columns";
import { sql } from "drizzle-orm";
import { check, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "../shared/base";
import { type DockKind } from "../shared/contract-values";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "../shared/columns";

/** A Unit-owned composition surface whose placement is decided by its product route. */
export const unitDock = pgTable(
	"unit_dock",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid().notNull(),
		kind: text().$type<DockKind>().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Structured contract: Dock display copy is referenced through localized Units. */
		document: createJsonDocumentColumn().notNull(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_dock", "unit", table, false, table.unitId),

		unique("unit_dock_unit_kind_key").on(table.unitId, table.kind),
		check("unit_dock_kind_check", sql`${table.kind} in ('main', 'wiki')`),
		check(
			"unit_dock_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

import { sql } from "drizzle-orm";
import { check, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { type DockSurface } from "./contract-values";
import { createCreatedAtColumn, createJsonDocumentColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./core";

/** A Unit-owned composition surface whose placement is decided by its product route. */
export const unitDock = pgTable(
	"unit_dock",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		surface: text().$type<DockSurface>().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Structured contract: Dock display copy is referenced through localized Units. */
		document: createJsonDocumentColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.surface] }),
		check("unit_dock_surface_check", sql`${table.surface} in ('main', 'wiki')`),
	],
);

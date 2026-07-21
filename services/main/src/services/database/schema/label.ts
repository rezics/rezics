import { uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./core";

/**
 * A lightweight localized-title Unit for headings and display labels.
 *
 * Label content lives in Unit localizations; this marker deliberately has no
 * domain fields of its own.
 */
export const label = pgTable("label", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

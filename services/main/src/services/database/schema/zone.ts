import { sql } from "drizzle-orm";
import { check, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
} from "./columns";
import { unit } from "./core";

export const zone = pgTable(
	"zone",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		/** @UNIT_LOCALIZATION_EXEMPT Structured contract: search boundary contains only categories and filters. */
		boundaryDocument: createJsonDocumentColumn().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Structured contract: theme contains only color and density tokens. */
		themeDocument: createJsonDocumentColumn().notNull(),
		startsAt: createTimestampMsColumn(),
		endsAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"zone_time_range_check",
			sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} > ${table.startsAt}`,
		),
	],
);

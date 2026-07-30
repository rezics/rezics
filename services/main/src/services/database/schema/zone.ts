import { sql } from "drizzle-orm";
import { check, index, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
} from "./columns";
import { unit } from "./unit";

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

/**
 * Proves that a Zone Page Unit belongs to a Zone.
 *
 * The same Unit also has `post.kind = page` with this Zone as its subject.
 * Slug addresses are optional and page-structure is only a visual index, so
 * neither can serve as the ownership relation.
 */
export const zonePage = pgTable(
	"zone_page",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [index("zone_page_zone_created_idx").on(table.zoneId, table.createdAt, table.id)],
);

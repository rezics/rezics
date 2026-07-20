import { sql } from "drizzle-orm";
import { boolean, check, index, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
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

/** A Zone route composes existing Units and features; it does not own wiki/content data. */
export const zonePage = pgTable(
	"zone_page",
	{
		id: createUuidv7PrimaryKey(),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "cascade" }),
		slug: text().notNull(),
		titleUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		document: createJsonDocumentColumn().notNull(),
		position: fractionalIndexPosition().notNull(),
		home: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("zone_page_zone_slug_key").on(table.zoneId, table.slug),
		uniqueIndex("zone_page_one_home_key")
			.on(table.zoneId)
			.where(sql`${table.home}`),
		index("zone_page_zone_position_idx").on(table.zoneId, table.position, table.id),
		index("zone_page_title_unit_idx").on(table.titleUnitId),
		check(
			"zone_page_slug_check",
			sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${table.slug}) <= 100`,
		),
	],
);

/** Menu content is independent from Menu Block presentation and can be reused by many pages. */
export const zoneNavigation = pgTable(
	"zone_navigation",
	{
		id: createUuidv7PrimaryKey(),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "cascade" }),
		document: createJsonDocumentColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("zone_navigation_zone_created_idx").on(table.zoneId, table.createdAt, table.id),
	],
);

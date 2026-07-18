import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";
import { realm } from "./realm";

export const zone = pgTable(
	"zone",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		managingRealmId: uuid().references(() => realm.id, {
			onDelete: "set null",
		}),
		boundaryDocument: createJsonDocumentColumn().notNull(),
		themeDocument: createJsonDocumentColumn().notNull(),
		startsAt: createTimestampMsColumn(),
		endsAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("zone_managing_realm_idx").on(table.managingRealmId),
		check(
			"zone_not_managing_realm_check",
			sql`${table.managingRealmId} is null or ${table.id} <> ${table.managingRealmId}`,
		),
		check(
			"zone_time_range_check",
			sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} > ${table.startsAt}`,
		),
	],
);

export const zonePage = pgTable(
	"zone_page",
	{
		id: createUuidv7PrimaryKey(),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "cascade" }),
		slug: text().notNull(),
		document: createJsonDocumentColumn().notNull(),
		position: text().default("V").notNull(),
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
		check("zone_page_slug_not_blank", sql`btrim(${table.slug}) <> ''`),
	],
);

export const zoneMenu = pgTable(
	"zone_menu",
	{
		id: createUuidv7PrimaryKey(),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "cascade" }),
		slot: text().default("primary").notNull(),
		document: createJsonDocumentColumn().notNull(),
		position: text().default("V").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("zone_menu_zone_slot_key").on(table.zoneId, table.slot),
		index("zone_menu_zone_position_idx").on(table.zoneId, table.position, table.id),
		check("zone_menu_slot_not_blank", sql`btrim(${table.slot}) <> ''`),
	],
);

export const zoneSubscription = pgTable(
	"zone_subscription",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.zoneId] }),
		index("zone_subscription_zone_created_at_idx").on(
			table.zoneId,
			table.createdAt.desc(),
			table.profileId,
		),
	],
);

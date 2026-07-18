import { sql } from "drizzle-orm";
import { check, index, primaryKey, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
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
		/** @UNIT_LOCALIZATION_EXEMPT Machine-readable Zone membership boundary. */
		boundaryDocument: createJsonDocumentColumn().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Visual theme configuration without localized copy. */
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

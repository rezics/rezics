import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { profile, unit } from "./core";
import { realm } from "./realm";

export const score = pgTable(
	"score",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId, table.realmId] }),
		index("score_unit_realm_value_idx").on(table.unitId, table.realmId, table.value),
		index("score_realm_idx").on(table.realmId),
		check("score_value_check", sql`${table.value} between 1 and 10`),
	],
);

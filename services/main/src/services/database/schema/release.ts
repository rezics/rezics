import { sql } from "drizzle-orm";
import { check, date, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./core";

export const release = pgTable(
	"release",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		parentUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		versionLabel: text().notNull(),
		releasedOn: date(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("release_parent_version_key").on(table.parentUnitId, table.versionLabel),
		index("release_parent_released_on_idx").on(table.parentUnitId, table.releasedOn, table.id),
		check("release_version_label_not_blank", sql`btrim(${table.versionLabel}) <> ''`),
		check("release_not_self_check", sql`${table.id} <> ${table.parentUnitId}`),
	],
);

import { sql } from "drizzle-orm";
import { check, date, index, integer, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./core";

export const media = pgTable(
	"media",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().notNull(),
		releaseDate: date(),
		runtimeMinutes: integer(),
		episodeCount: integer(),
		seasonCount: integer(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("media_kind_release_date_idx").on(table.kind, table.releaseDate),
		check("media_kind_not_blank", sql`btrim(${table.kind}) <> ''`),
		check(
			"media_runtime_check",
			sql`${table.runtimeMinutes} is null or ${table.runtimeMinutes} > 0`,
		),
		check(
			"media_episode_count_check",
			sql`${table.episodeCount} is null or ${table.episodeCount} > 0`,
		),
		check(
			"media_season_count_check",
			sql`${table.seasonCount} is null or ${table.seasonCount} > 0`,
		),
	],
);

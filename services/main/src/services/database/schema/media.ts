import { inArray, sql } from "drizzle-orm";
import { check, date, index, integer, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { WorkReleaseStatusValues } from "./contract-values";
import { unit } from "./unit";

export const media = pgTable(
	"media",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		releaseStatus: text({ enum: WorkReleaseStatusValues }).notNull(),
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
		check("media_release_status_check", inArray(table.releaseStatus, WorkReleaseStatusValues)),
	],
);

export const video = pgTable(
	"video",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		durationSeconds: integer(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"video_duration_seconds_check",
			sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`,
		),
	],
);

export const audio = pgTable(
	"audio",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		durationSeconds: integer(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"audio_duration_seconds_check",
			sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`,
		),
	],
);

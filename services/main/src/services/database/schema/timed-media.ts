import { sql } from "drizzle-orm";
import { check, foreignKey, integer, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./core";

function createTimedMediaColumns() {
	return {
		durationSeconds: integer(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	};
}

export const video = pgTable(
	"video",
	{
		id: uuid().primaryKey(),
		unitKind: text().$type<"video">().default("video").notNull(),
		...createTimedMediaColumns(),
	},
	(table) => [
		foreignKey({
			columns: [table.id, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "video_unit_kind_fkey",
		}).onDelete("cascade"),
		check("video_unit_kind_check", sql`${table.unitKind} = 'video'`),
		check(
			"video_duration_seconds_check",
			sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`,
		),
	],
);

export const audio = pgTable(
	"audio",
	{
		id: uuid().primaryKey(),
		unitKind: text().$type<"audio">().default("audio").notNull(),
		...createTimedMediaColumns(),
	},
	(table) => [
		foreignKey({
			columns: [table.id, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "audio_unit_kind_fkey",
		}).onDelete("cascade"),
		check("audio_unit_kind_check", sql`${table.unitKind} = 'audio'`),
		check(
			"audio_duration_seconds_check",
			sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`,
		),
	],
);

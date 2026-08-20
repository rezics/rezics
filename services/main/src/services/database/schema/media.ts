import { inArray, sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	uuid,
} from "drizzle-orm/pg-core";

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
		/** Describes that REZICS should expose metadata, but not hosted work content. */
		metadataOnly: boolean("metadata_only").default(true).notNull(),
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

/**
 * Associates an independent Audio Unit that a Video may use as an external audio track.
 *
 * @remarks
 * The association currently serves the adapted-audio role. A Video may have no
 * rows and can still contain intrinsic sound; the row does not make Audio a
 * required component of every Video.
 */
export const videoAudioTrack = pgTable(
	"video_audio_track",
	{
		videoUnitId: uuid("video_unit_id").notNull(),
		audioUnitId: uuid("audio_unit_id").notNull(),
	},
	(table) => [
		primaryKey({
			name: "video_audio_track_video_audio_pkey",
			columns: [table.videoUnitId, table.audioUnitId],
		}),
		foreignKey({
			columns: [table.videoUnitId],
			foreignColumns: [video.id],
			name: "video_audio_track_video_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.audioUnitId],
			foreignColumns: [audio.id],
			name: "video_audio_track_audio_fkey",
		}).onDelete("restrict"),
		index("video_audio_track_audio_video_idx").on(table.audioUnitId, table.videoUnitId),
		check("video_audio_track_not_self_check", sql`${table.videoUnitId} <> ${table.audioUnitId}`),
	],
);

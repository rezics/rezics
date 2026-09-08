import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, primaryKey, uuid } from "drizzle-orm/pg-core";
import { createPlatformIdentityColumns, platformIdentityConstraints } from "./platform-identity";

import { pgTable } from "./base";

export const video = pgTable(
	"video",
	{
		...createPlatformIdentityColumns(),
		durationSeconds: integer(),
	},
	(table) => [
		...platformIdentityConstraints("video", table),
		check(
			"video_duration_seconds_check",
			sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`,
		),
	],
);

export const audio = pgTable(
	"audio",
	{
		...createPlatformIdentityColumns(),
		durationSeconds: integer(),
	},
	(table) => [
		...platformIdentityConstraints("audio", table),
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

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import {
	audio,
	MaximumAudioTracksPerVideo,
	unit,
	videoAudioTrack,
	type UnitKind,
} from "../database/schema";
import { type DatabaseExecutor, type DatabaseTransaction, database } from "../database";
import { VideoAudioTrackInvalid } from "./errors";

const VideoAudioTrackPath = "/details/adaptedAudioUnitIds";
const AudioTrackUnitIdsSchema = z
	.array(
		z
			.string()
			.uuid()
			.transform((value) => value.toLowerCase()),
	)
	.max(MaximumAudioTracksPerVideo)
	.superRefine((values, context) => {
		const seen = new Set<string>();
		for (const [index, value] of values.entries()) {
			if (seen.has(value))
				context.addIssue({
					code: "custom",
					path: [index],
					message: "must not contain duplicate Unit IDs",
				});
			seen.add(value);
		}
	});

type VideoAudioTrackState = {
	readonly videoUnitId: string;
	readonly audioUnitId: string;
};

function compareCodePoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function parseAudioTrackUnitIds(
	value: unknown,
	onInvalid: (suffix: string, reason: string) => Error,
): readonly string[] {
	const result = AudioTrackUnitIdsSchema.safeParse(value ?? []);
	if (!result.success) {
		const issue = result.error.issues[0];
		const suffix = issue?.path.length ? `/${issue.path.join("/")}` : "";
		throw onInvalid(suffix, issue?.message ?? "is invalid");
	}
	return Object.freeze([...result.data].sort(compareCodePoints));
}

/** Normalizes the adapted-Audio API projection into a deterministic track set. */
export function normalizeAdaptedAudioUnitIds(value: unknown): readonly string[] {
	return parseAudioTrackUnitIds(
		value,
		(suffix, reason) => new VideoAudioTrackInvalid(`${VideoAudioTrackPath}${suffix}`, reason),
	);
}

function audioTrackStates(
	videoUnitId: string,
	audioUnitIds: readonly string[],
): VideoAudioTrackState[] {
	return audioUnitIds.map((audioUnitId) => ({ videoUnitId, audioUnitId }));
}

/** Reads the complete, application-bounded adapted-Audio track set in stable order. */
export async function listAdaptedAudioUnitIds(
	videoUnitId: string,
	executor: DatabaseExecutor = database,
): Promise<readonly string[]> {
	const rows = await executor
		.select({ audioUnitId: videoAudioTrack.audioUnitId })
		.from(videoAudioTrack)
		.where(eq(videoAudioTrack.videoUnitId, videoUnitId))
		.orderBy(asc(videoAudioTrack.audioUnitId))
		.limit(MaximumAudioTracksPerVideo + 1);
	if (rows.length > MaximumAudioTracksPerVideo)
		throw new Error(`Video ${videoUnitId} exceeds the Audio track bound`);
	return rows.map(({ audioUnitId }) => audioUnitId);
}

async function assertLiveAudioUnits(
	tx: DatabaseTransaction,
	audioUnitIds: readonly string[],
): Promise<void> {
	if (!audioUnitIds.length) return;
	const rows = await tx
		.select({ id: audio.id })
		.from(audio)
		.innerJoin(unit, eq(unit.id, audio.id))
		.where(and(inArray(audio.id, audioUnitIds), eq(unit.kind, "audio"), isNull(unit.deletedAt)));
	if (rows.length !== audioUnitIds.length)
		throw new VideoAudioTrackInvalid(VideoAudioTrackPath, "contains an unavailable Audio Unit");
}

/**
 * Replaces the adapted-Audio projection of one Video's external track set.
 *
 * The caller must already hold the Video aggregate's CAS transaction. Target
 * proof and the delete/insert happen within that same short transaction.
 */
export async function replaceAdaptedAudioUnitTracks(
	tx: DatabaseTransaction,
	videoUnitId: string,
	value: unknown,
): Promise<readonly string[]> {
	const audioUnitIds = normalizeAdaptedAudioUnitIds(value);
	await assertLiveAudioUnits(tx, audioUnitIds);
	const currentRows = await tx
		.select({ audioUnitId: videoAudioTrack.audioUnitId })
		.from(videoAudioTrack)
		.where(eq(videoAudioTrack.videoUnitId, videoUnitId))
		.orderBy(videoAudioTrack.audioUnitId)
		.limit(MaximumAudioTracksPerVideo + 1);
	if (currentRows.length > MaximumAudioTracksPerVideo)
		throw new Error(`Video ${videoUnitId} exceeds the Audio track bound`);
	const currentIds = new Set(currentRows.map(({ audioUnitId }) => audioUnitId));
	const desiredIds = new Set(audioUnitIds);
	const removedIds = currentRows
		.map(({ audioUnitId }) => audioUnitId)
		.filter((audioUnitId) => !desiredIds.has(audioUnitId));
	if (removedIds.length)
		await tx
			.delete(videoAudioTrack)
			.where(
				and(
					eq(videoAudioTrack.videoUnitId, videoUnitId),
					inArray(videoAudioTrack.audioUnitId, removedIds),
				),
			);
	const addedStates = audioTrackStates(videoUnitId, audioUnitIds).filter(
		({ audioUnitId }) => !currentIds.has(audioUnitId),
	);
	if (addedStates.length) await tx.insert(videoAudioTrack).values(addedStates);
	return audioUnitIds;
}

/**
 * Restores the complete external Audio track set owned by one Video revision.
 *
 * Historical Audio targets may be soft-deleted because restore reproduces
 * authored history; the subtype foreign key still requires their durable Audio
 * identity to exist.
 */
export async function restoreVideoAudioTracks(
	tx: DatabaseTransaction,
	unitId: string,
	unitKind: UnitKind,
	value: unknown,
): Promise<void> {
	const audioUnitIds = parseAudioTrackUnitIds(
		value,
		() => new Error("Invalid Video Audio track history state"),
	);
	if (unitKind !== "video") {
		if (audioUnitIds.length)
			throw new Error("Only Video revision history may contain external Audio tracks");
		return;
	}
	if (audioUnitIds.some((audioUnitId) => audioUnitId === unitId))
		throw new Error("A Video Audio track cannot reference the same Unit identity");
	await tx.delete(videoAudioTrack).where(eq(videoAudioTrack.videoUnitId, unitId));
	const states = audioTrackStates(unitId, audioUnitIds);
	if (states.length) await tx.insert(videoAudioTrack).values(states);
}

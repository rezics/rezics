import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	contentStructure,
	contentStructureNode,
	contentStructureNodeProgress,
	contentStructureRevisionHead,
	DefaultResourceVisibility,
	audio,
	type ProgressCurrentBasis,
	type ProgressDatePrecision,
	type ProgressEntryKind,
	type ProgressStatus,
	postProgressEntry,
	post,
	unit,
	unitProgress,
	unitProgressEntry,
	video,
} from "../../database/schema";
import { ContentStructureNodeNotFound } from "../content-structure/errors";
import { ValidationError } from "../errors";
import { ProgressEntryNotFound } from "./errors";

export interface ProgressEntryContentInput {
	readonly entryKind: ProgressEntryKind;
	readonly status: ProgressStatus;
	readonly progress?: number;
	readonly totalTimeMs?: number;
	readonly lastContentStructureNodeId?: string | null;
	readonly occurredAt: Date | null;
	readonly datePrecision: ProgressDatePrecision;
}

export interface ProgressEntryWriteInput extends ProgressEntryContentInput {
	readonly affectsCurrent: boolean;
}

type ProgressSnapshot = {
	readonly completedCount: number;
	readonly currentEntryId: string | null;
	readonly currentBasis: ProgressCurrentBasis | null;
	readonly firstSeenAt: Date;
	readonly lastSeenAt: Date;
	readonly progress: number;
	readonly status: ProgressStatus;
	readonly totalTimeMs: bigint;
	readonly lastContentStructureNodeId: string | null;
	readonly visibility: "public" | "unlisted" | "private";
};

const AutomaticProgressCheckpointIntervalMs = 24 * 60 * 60 * 1_000;

export async function lockUnitProgress(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-progress:${profileId}:${unitId}`}::text, 0))`,
	);
}

/**
 * Decides whether a rolling automatic Progress checkpoint is due.
 *
 * @internal
 */
export function isAutomaticProgressCheckpointDue(
	lastCheckpointCreatedAt: Date | undefined,
	now: Date,
): boolean {
	return (
		lastCheckpointCreatedAt === undefined ||
		lastCheckpointCreatedAt.getTime() <= now.getTime() - AutomaticProgressCheckpointIntervalMs
	);
}

async function findProgressSnapshot(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
): Promise<ProgressSnapshot | undefined> {
	const [snapshot] = await tx
		.select({
			completedCount: unitProgress.completedCount,
			currentEntryId: unitProgress.currentEntryId,
			currentBasis: unitProgress.currentBasis,
			firstSeenAt: unitProgress.firstSeenAt,
			lastSeenAt: unitProgress.lastSeenAt,
			progress: unitProgress.progress,
			status: unitProgress.status,
			totalTimeMs: unitProgress.totalTimeMs,
			lastContentStructureNodeId: unitProgress.lastContentStructureNodeId,
			visibility: unitProgress.visibility,
		})
		.from(unitProgress)
		.where(
			and(
				eq(unitProgress.profileId, profileId),
				eq(unitProgress.unitId, unitId),
				isNull(unitProgress.deletedAt),
			),
		)
		.limit(1);
	return snapshot;
}

async function resolveContentStructureRevision(
	tx: DatabaseTransaction,
	unitId: string,
	nodeId: string | null,
): Promise<string | null> {
	if (!nodeId) return null;
	const [node] = await tx
		.select({ revisionId: contentStructureRevisionHead.revisionId })
		.from(contentStructureNode)
		.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
		.leftJoin(
			contentStructureRevisionHead,
			eq(contentStructureRevisionHead.structureId, contentStructure.id),
		)
		.where(
			and(
				eq(contentStructureNode.id, nodeId),
				eq(contentStructureNode.ownerUnitId, unitId),
				inArray(contentStructure.kind, ["book.contents", "media.contents"]),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!node) throw new ContentStructureNodeNotFound();
	return node.revisionId;
}

export function deriveMediaNodeCompletionProgress(
	items: readonly {
		readonly durationSeconds: number | null;
		readonly completed: boolean;
	}[],
): { readonly progress: number; readonly status: "active" | "completed" } {
	if (!items.length) throw new TypeError("Media progress requires at least one item");
	const allDurationsKnown = items.every(
		(item) =>
			item.durationSeconds !== null &&
			Number.isSafeInteger(item.durationSeconds) &&
			item.durationSeconds > 0,
	);
	const completedItems = items.filter(({ completed }) => completed);
	const progress = allDurationsKnown
		? completedItems.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0) /
			items.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0)
		: completedItems.length / items.length;
	return { progress, status: progress === 1 ? "completed" : "active" };
}

/**
 * Records or removes one completed Video or Audio occurrence and materializes
 * its parent Media progress. Complete durations are weighted only when every
 * readable item has a known duration; otherwise the deterministic item-count
 * ratio is used.
 *
 * @internal
 */
export async function recordMediaNodeCompletion(
	tx: DatabaseTransaction,
	input: {
		readonly canReadUnpublished: boolean;
		readonly completed: boolean;
		readonly nodeId: string;
		readonly now: Date;
		readonly profileId: string;
		readonly unitId: string;
	},
) {
	await lockUnitProgress(tx, input.profileId, input.unitId);
	const readableUnitCondition = input.canReadUnpublished
		? undefined
		: and(eq(unit.status, "published"), inArray(unit.visibility, ["public", "unlisted"]));
	const [target] = await tx
		.select({ id: contentStructureNode.id })
		.from(contentStructureNode)
		.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.where(
			and(
				eq(contentStructureNode.id, input.nodeId),
				eq(contentStructureNode.ownerUnitId, input.unitId),
				eq(contentStructure.kind, "media.contents"),
				inArray(unit.kind, ["video", "audio"]),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
				isNull(unit.deletedAt),
				readableUnitCondition,
			),
		)
		.limit(1);
	if (!target) throw new ContentStructureNodeNotFound();

	if (input.completed)
		await tx
			.insert(contentStructureNodeProgress)
			.values({ profileId: input.profileId, nodeId: input.nodeId, completedAt: input.now })
			.onConflictDoNothing();
	else
		await tx
			.delete(contentStructureNodeProgress)
			.where(
				and(
					eq(contentStructureNodeProgress.profileId, input.profileId),
					eq(contentStructureNodeProgress.nodeId, input.nodeId),
				),
			);

	const items = await tx
		.select({
			durationSeconds: sql<number | null>`case
				when ${unit.kind} = 'video' then ${video.durationSeconds}
				when ${unit.kind} = 'audio' then ${audio.durationSeconds}
				else null
			end`,
			completedAt: contentStructureNodeProgress.completedAt,
		})
		.from(contentStructureNode)
		.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.leftJoin(video, eq(video.id, contentStructureNode.contentUnitId))
		.leftJoin(audio, eq(audio.id, contentStructureNode.contentUnitId))
		.leftJoin(
			contentStructureNodeProgress,
			and(
				eq(contentStructureNodeProgress.profileId, input.profileId),
				eq(contentStructureNodeProgress.nodeId, contentStructureNode.id),
			),
		)
		.where(
			and(
				eq(contentStructureNode.ownerUnitId, input.unitId),
				eq(contentStructure.kind, "media.contents"),
				inArray(unit.kind, ["video", "audio"]),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
				isNull(unit.deletedAt),
				readableUnitCondition,
			),
		);
	if (!items.length) throw new ContentStructureNodeNotFound();
	const { progress, status } = deriveMediaNodeCompletionProgress(
		items.map((item) => ({
			durationSeconds: item.durationSeconds,
			completed: item.completedAt !== null,
		})),
	);
	const snapshot = await findProgressSnapshot(tx, input.profileId, input.unitId);
	const [record] = await tx
		.insert(unitProgress)
		.values({
			profileId: input.profileId,
			unitId: input.unitId,
			status,
			progress,
			completedCount: snapshot?.completedCount ?? 0,
			totalTimeMs: snapshot?.totalTimeMs ?? 0n,
			firstSeenAt: snapshot?.firstSeenAt ?? input.now,
			lastSeenAt: input.now,
			lastContentStructureNodeId: status === "completed" ? null : input.nodeId,
			currentEntryId: null,
			currentBasis: "reading",
			visibility: snapshot?.visibility ?? DefaultResourceVisibility,
			deletedAt: null,
		})
		.onConflictDoUpdate({
			target: [unitProgress.profileId, unitProgress.unitId],
			set: {
				status,
				progress,
				completedCount: snapshot?.completedCount ?? 0,
				totalTimeMs: snapshot?.totalTimeMs ?? 0n,
				firstSeenAt: snapshot?.firstSeenAt ?? input.now,
				lastSeenAt: input.now,
				lastContentStructureNodeId: status === "completed" ? null : input.nodeId,
				currentEntryId: null,
				currentBasis: "reading",
				visibility: snapshot?.visibility ?? DefaultResourceVisibility,
				deletedAt: null,
				updatedAt: input.now,
			},
		})
		.returning();
	if (!record) throw new Error("Media node progress upsert did not return a row");
	return record;
}

function validateOccurredAt(occurredAt: Date | null, datePrecision: ProgressDatePrecision): void {
	const isUnknown = datePrecision === "unknown";
	if (isUnknown !== (occurredAt === null) || (occurredAt && Number.isNaN(occurredAt.getTime())))
		throw new ValidationError({
			occurredAt: "occurredAt must be null exactly when datePrecision is unknown",
		});
}

function normalizeEntry(
	input: ProgressEntryContentInput,
	snapshot: ProgressSnapshot | undefined,
): {
	readonly completionDelta: 0 | 1;
	readonly contentStructureNodeId: string | null;
	readonly progress: number;
	readonly status: ProgressStatus;
	readonly totalTimeMs: bigint;
} {
	if (input.entryKind === "completion")
		return {
			completionDelta: 1,
			contentStructureNodeId: null,
			progress: 1,
			status: "completed",
			totalTimeMs:
				input.totalTimeMs === undefined
					? (snapshot?.totalTimeMs ?? 0n)
					: BigInt(input.totalTimeMs),
		};
	const atBoundary = input.status === "backlog" || input.status === "completed";
	return {
		completionDelta: 0,
		contentStructureNodeId: atBoundary
			? null
			: (input.lastContentStructureNodeId ?? snapshot?.lastContentStructureNodeId ?? null),
		progress:
			input.status === "backlog"
				? 0
				: input.status === "completed"
					? 1
					: (input.progress ?? snapshot?.progress ?? 0),
		status: input.status,
		totalTimeMs:
			input.totalTimeMs === undefined
				? (snapshot?.totalTimeMs ?? 0n)
				: BigInt(input.totalTimeMs),
	};
}

async function findCurrentEntry(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
	snapshot: ProgressSnapshot | undefined,
	preferredCurrentEntryId: string | undefined,
) {
	if (preferredCurrentEntryId) {
		const [preferred] = await tx
			.select()
			.from(unitProgressEntry)
			.where(
				and(
					eq(unitProgressEntry.id, preferredCurrentEntryId),
					eq(unitProgressEntry.profileId, profileId),
					eq(unitProgressEntry.unitId, unitId),
					eq(unitProgressEntry.affectsCurrent, true),
					isNull(unitProgressEntry.deletedAt),
				),
			)
			.limit(1);
		if (preferred) return preferred;
	}
	if (snapshot?.currentEntryId) {
		const [retained] = await tx
			.select()
			.from(unitProgressEntry)
			.where(
				and(
					eq(unitProgressEntry.id, snapshot.currentEntryId),
					eq(unitProgressEntry.profileId, profileId),
					eq(unitProgressEntry.unitId, unitId),
					eq(unitProgressEntry.affectsCurrent, true),
					isNull(unitProgressEntry.deletedAt),
				),
			)
			.limit(1);
		if (retained) return retained;
	}
	const [latest] = await tx
		.select()
		.from(unitProgressEntry)
		.where(
			and(
				eq(unitProgressEntry.profileId, profileId),
				eq(unitProgressEntry.unitId, unitId),
				eq(unitProgressEntry.affectsCurrent, true),
				isNull(unitProgressEntry.deletedAt),
			),
		)
		.orderBy(desc(unitProgressEntry.createdAt), desc(unitProgressEntry.id))
		.limit(1);
	return latest;
}

export async function refreshProgressSnapshot(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
	preferredCurrentEntryId?: string,
): Promise<void> {
	const snapshot = await findProgressSnapshot(tx, profileId, unitId);
	const readingSnapshot =
		preferredCurrentEntryId === undefined && snapshot?.currentBasis === "reading"
			? snapshot
			: undefined;
	const current = readingSnapshot
		? undefined
		: await findCurrentEntry(tx, profileId, unitId, snapshot, preferredCurrentEntryId);
	const [statistics] = await tx
		.select({
			completedCount: sql<number>`coalesce(sum(${unitProgressEntry.completionDelta})::int, 0)`,
			firstSeenAt: sql<Date | null>`min(coalesce(${unitProgressEntry.occurredAt}, ${unitProgressEntry.createdAt}))`,
			lastSeenAt: sql<Date | null>`max(coalesce(${unitProgressEntry.occurredAt}, ${unitProgressEntry.createdAt}))`,
		})
		.from(unitProgressEntry)
		.where(
			and(
				eq(unitProgressEntry.profileId, profileId),
				eq(unitProgressEntry.unitId, unitId),
				isNull(unitProgressEntry.deletedAt),
			),
		);
	if (!statistics?.firstSeenAt || !statistics.lastSeenAt) {
		if (readingSnapshot) {
			await tx
				.update(unitProgress)
				.set({
					completedCount: 0,
					currentEntryId: null,
					currentBasis: "reading",
					deletedAt: null,
					updatedAt: new Date(),
				})
				.where(and(eq(unitProgress.profileId, profileId), eq(unitProgress.unitId, unitId)));
			return;
		}
		await tx
			.update(unitProgress)
			.set({
				currentEntryId: null,
				currentBasis: null,
				deletedAt: new Date(),
				lastSeenAt: new Date(),
			})
			.where(and(eq(unitProgress.profileId, profileId), eq(unitProgress.unitId, unitId)));
		return;
	}
	const completedCount = toSafeInteger(statistics.completedCount, "progress completion count");
	const firstSeenAt =
		readingSnapshot && readingSnapshot.firstSeenAt < statistics.firstSeenAt
			? readingSnapshot.firstSeenAt
			: statistics.firstSeenAt;
	const lastSeenAt =
		readingSnapshot && readingSnapshot.lastSeenAt > statistics.lastSeenAt
			? readingSnapshot.lastSeenAt
			: statistics.lastSeenAt;
	const status = readingSnapshot ? readingSnapshot.status : (current?.status ?? "backlog");
	const progress = readingSnapshot ? readingSnapshot.progress : (current?.progress ?? 0);
	const totalTimeMs = readingSnapshot
		? readingSnapshot.totalTimeMs
		: (current?.totalTimeMs ?? 0n);
	const lastContentStructureNodeId = readingSnapshot
		? readingSnapshot.lastContentStructureNodeId
		: (current?.contentStructureNodeId ?? null);
	const currentEntryId = readingSnapshot ? null : (current?.id ?? null);
	const currentBasis = readingSnapshot
		? ("reading" as const)
		: current
			? ("journal" as const)
			: null;
	await tx
		.insert(unitProgress)
		.values({
			profileId,
			unitId,
			status,
			progress,
			completedCount,
			totalTimeMs,
			firstSeenAt,
			lastSeenAt,
			lastContentStructureNodeId,
			currentEntryId,
			currentBasis,
			visibility: DefaultResourceVisibility,
			deletedAt: null,
		})
		.onConflictDoUpdate({
			target: [unitProgress.profileId, unitProgress.unitId],
			set: {
				status,
				progress,
				completedCount,
				totalTimeMs,
				firstSeenAt,
				lastSeenAt,
				lastContentStructureNodeId,
				currentEntryId,
				currentBasis,
				deletedAt: null,
			},
		});
}

/**
 * Derives the aggregate Book progress represented by completed chapter nodes.
 *
 * @internal
 */
export function deriveChapterReadingProgress(
	completedChapterCount: number,
	totalChapterCount: number,
): { readonly progress: number; readonly status: "active" | "completed" } {
	if (
		!Number.isSafeInteger(completedChapterCount) ||
		!Number.isSafeInteger(totalChapterCount) ||
		totalChapterCount <= 0 ||
		completedChapterCount < 0 ||
		completedChapterCount > totalChapterCount
	)
		throw new Error("Chapter completion counts must describe a non-empty bounded Book");
	return {
		progress: completedChapterCount / totalChapterCount,
		status: completedChapterCount === totalChapterCount ? "completed" : "active",
	};
}

/**
 * Records one visible authenticated Book chapter read.
 *
 * @internal
 */
export async function recordChapterReading(
	tx: DatabaseTransaction,
	input: {
		readonly canReadUnpublished: boolean;
		readonly nodeId: string;
		readonly now: Date;
		readonly profileId: string;
		readonly unitId: string;
	},
) {
	await lockUnitProgress(tx, input.profileId, input.unitId);
	const readableUnitCondition = input.canReadUnpublished
		? undefined
		: and(eq(unit.status, "published"), inArray(unit.visibility, ["public", "unlisted"]));
	const [chapterNode] = await tx
		.select({ id: contentStructureNode.id })
		.from(contentStructureNode)
		.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
		.where(
			and(
				eq(contentStructureNode.id, input.nodeId),
				eq(contentStructureNode.ownerUnitId, input.unitId),
				eq(contentStructure.kind, "book.contents"),
				eq(unit.kind, "post"),
				eq(post.kind, "chapter"),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
				isNull(unit.deletedAt),
				readableUnitCondition,
			),
		)
		.limit(1);
	if (!chapterNode) throw new ContentStructureNodeNotFound();

	await tx
		.insert(contentStructureNodeProgress)
		.values({ profileId: input.profileId, nodeId: input.nodeId, completedAt: input.now })
		.onConflictDoNothing();

	const [chapterCounts] = await tx
		.select({
			completed: sql<number>`count(${contentStructureNodeProgress.nodeId})::int`,
			total: sql<number>`count(*)::int`,
		})
		.from(contentStructureNode)
		.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
		.leftJoin(
			contentStructureNodeProgress,
			and(
				eq(contentStructureNodeProgress.profileId, input.profileId),
				eq(contentStructureNodeProgress.nodeId, contentStructureNode.id),
			),
		)
		.where(
			and(
				eq(contentStructureNode.ownerUnitId, input.unitId),
				eq(contentStructure.kind, "book.contents"),
				eq(unit.kind, "post"),
				eq(post.kind, "chapter"),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
				isNull(unit.deletedAt),
				readableUnitCondition,
			),
		);
	if (!chapterCounts) throw new Error("Book chapter progress aggregation returned no row");
	const completedChapterCount = toSafeInteger(
		chapterCounts.completed,
		"completed Book chapter count",
	);
	const totalChapterCount = toSafeInteger(chapterCounts.total, "Book chapter count");
	const reading = deriveChapterReadingProgress(completedChapterCount, totalChapterCount);

	const [lastCheckpoint] = await tx
		.select({ createdAt: unitProgressEntry.createdAt })
		.from(unitProgressEntry)
		.where(
			and(
				eq(unitProgressEntry.profileId, input.profileId),
				eq(unitProgressEntry.unitId, input.unitId),
				isNull(unitProgressEntry.deletedAt),
			),
		)
		.orderBy(desc(unitProgressEntry.createdAt), desc(unitProgressEntry.id))
		.limit(1);
	const journalEntryCreated = isAutomaticProgressCheckpointDue(
		lastCheckpoint?.createdAt,
		input.now,
	);
	if (journalEntryCreated)
		await createProgressEntry(
			tx,
			input.profileId,
			input.unitId,
			{
				entryKind: "update",
				status: reading.status,
				progress: reading.progress,
				lastContentStructureNodeId: reading.status === "completed" ? null : input.nodeId,
				occurredAt: input.now,
				datePrecision: "instant",
				affectsCurrent: false,
			},
			{ refreshSnapshot: false },
		);

	const snapshot = await findProgressSnapshot(tx, input.profileId, input.unitId);
	const [record] = await tx
		.insert(unitProgress)
		.values({
			profileId: input.profileId,
			unitId: input.unitId,
			status: reading.status,
			progress: reading.progress,
			completedCount: snapshot?.completedCount ?? 0,
			totalTimeMs: snapshot?.totalTimeMs ?? 0n,
			firstSeenAt: snapshot?.firstSeenAt ?? input.now,
			lastSeenAt: input.now,
			lastContentStructureNodeId: reading.status === "completed" ? null : input.nodeId,
			currentEntryId: null,
			currentBasis: "reading",
			visibility: snapshot?.visibility ?? DefaultResourceVisibility,
			deletedAt: null,
		})
		.onConflictDoUpdate({
			target: [unitProgress.profileId, unitProgress.unitId],
			set: {
				status: reading.status,
				progress: reading.progress,
				completedCount: snapshot?.completedCount ?? 0,
				totalTimeMs: snapshot?.totalTimeMs ?? 0n,
				firstSeenAt: snapshot?.firstSeenAt ?? input.now,
				lastSeenAt: input.now,
				lastContentStructureNodeId: reading.status === "completed" ? null : input.nodeId,
				currentEntryId: null,
				currentBasis: "reading",
				visibility: snapshot?.visibility ?? DefaultResourceVisibility,
				deletedAt: null,
				updatedAt: input.now,
			},
		})
		.returning();
	if (!record) throw new Error("Chapter reading progress upsert did not return a row");
	return { journalEntryCreated, record };
}

export async function createProgressEntry(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
	input: ProgressEntryWriteInput,
	options: { readonly refreshSnapshot?: boolean } = {},
) {
	validateOccurredAt(input.occurredAt, input.datePrecision);
	const snapshot = await findProgressSnapshot(tx, profileId, unitId);
	const normalized = normalizeEntry(input, snapshot);
	const contentStructureRevisionId = await resolveContentStructureRevision(
		tx,
		unitId,
		normalized.contentStructureNodeId,
	);
	const [entry] = await tx
		.insert(unitProgressEntry)
		.values({
			profileId,
			unitId,
			entryKind: input.entryKind,
			status: normalized.status,
			progress: normalized.progress,
			completionDelta: normalized.completionDelta,
			totalTimeMs: normalized.totalTimeMs,
			contentStructureNodeId: normalized.contentStructureNodeId,
			contentStructureRevisionId,
			occurredAt: input.occurredAt,
			datePrecision: input.datePrecision,
			affectsCurrent: input.affectsCurrent,
		})
		.returning();
	if (!entry) throw new Error("Progress entry insert did not return a row");
	if (options.refreshSnapshot !== false)
		await refreshProgressSnapshot(
			tx,
			profileId,
			unitId,
			input.affectsCurrent ? entry.id : undefined,
		);
	return entry;
}

export async function replaceProgressEntry(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
	entryId: string,
	input: ProgressEntryContentInput,
) {
	validateOccurredAt(input.occurredAt, input.datePrecision);
	const [existing] = await tx
		.select({ id: unitProgressEntry.id })
		.from(unitProgressEntry)
		.where(
			and(
				eq(unitProgressEntry.id, entryId),
				eq(unitProgressEntry.profileId, profileId),
				eq(unitProgressEntry.unitId, unitId),
				isNull(unitProgressEntry.deletedAt),
			),
		)
		.limit(1);
	if (!existing) throw new ProgressEntryNotFound();
	const snapshot = await findProgressSnapshot(tx, profileId, unitId);
	const normalized = normalizeEntry(input, snapshot);
	const contentStructureRevisionId = await resolveContentStructureRevision(
		tx,
		unitId,
		normalized.contentStructureNodeId,
	);
	const [entry] = await tx
		.update(unitProgressEntry)
		.set({
			entryKind: input.entryKind,
			status: normalized.status,
			progress: normalized.progress,
			completionDelta: normalized.completionDelta,
			totalTimeMs: normalized.totalTimeMs,
			contentStructureNodeId: normalized.contentStructureNodeId,
			contentStructureRevisionId,
			occurredAt: input.occurredAt,
			datePrecision: input.datePrecision,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(unitProgressEntry.id, entryId),
				eq(unitProgressEntry.profileId, profileId),
				eq(unitProgressEntry.unitId, unitId),
				isNull(unitProgressEntry.deletedAt),
			),
		)
		.returning();
	if (!entry) throw new ProgressEntryNotFound();
	await refreshProgressSnapshot(tx, profileId, unitId);
	return entry;
}

export async function setCurrentProgressEntry(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
	entryId: string,
): Promise<void> {
	const [entry] = await tx
		.update(unitProgressEntry)
		.set({ affectsCurrent: true })
		.where(
			and(
				eq(unitProgressEntry.id, entryId),
				eq(unitProgressEntry.profileId, profileId),
				eq(unitProgressEntry.unitId, unitId),
				isNull(unitProgressEntry.deletedAt),
			),
		)
		.returning({ id: unitProgressEntry.id });
	if (!entry) throw new ProgressEntryNotFound();
	await refreshProgressSnapshot(tx, profileId, unitId, entry.id);
}

export async function deleteProgressEntry(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
	entryId: string,
): Promise<void> {
	const [deleted] = await tx
		.update(unitProgressEntry)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(unitProgressEntry.id, entryId),
				eq(unitProgressEntry.profileId, profileId),
				eq(unitProgressEntry.unitId, unitId),
				isNull(unitProgressEntry.deletedAt),
			),
		)
		.returning({ id: unitProgressEntry.id });
	if (!deleted) throw new ProgressEntryNotFound();
	await tx.delete(postProgressEntry).where(eq(postProgressEntry.progressEntryId, entryId));
	await refreshProgressSnapshot(tx, profileId, unitId);
}

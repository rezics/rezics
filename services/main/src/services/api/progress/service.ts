import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	contentStructure,
	contentStructureNode,
	contentStructureRevisionHead,
	type ProgressDatePrecision,
	type ProgressEntryKind,
	type ProgressSourceKind,
	type ProgressStatus,
	postProgressEntry,
	profilePreference,
	unitProgress,
	unitProgressEntry,
} from "../../database/schema";
import { ContentStructureNodeNotFound } from "../content-structure/errors";
import { ValidationError } from "../errors";
import { ProgressEntryNotFound } from "./errors";

export interface ProgressEntryWriteInput {
	readonly entryKind: ProgressEntryKind;
	readonly status: ProgressStatus;
	readonly progress?: number;
	readonly totalTimeMs?: number;
	readonly lastContentStructureNodeId?: string | null;
	readonly occurredAt: Date | null;
	readonly datePrecision: ProgressDatePrecision;
	readonly sourceKind: ProgressSourceKind;
	readonly sourceProvider?: string | null;
	readonly sourceExternalId?: string | null;
	readonly affectsCurrent: boolean;
}

type ProgressSnapshot = {
	readonly currentEntryId: string | null;
	readonly progress: number;
	readonly status: ProgressStatus;
	readonly totalTimeMs: bigint;
	readonly lastContentStructureNodeId: string | null;
};

export async function lockUnitProgress(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-progress:${profileId}:${unitId}`}::text, 0))`,
	);
}

async function findProgressSnapshot(
	tx: DatabaseTransaction,
	profileId: string,
	unitId: string,
): Promise<ProgressSnapshot | undefined> {
	const [snapshot] = await tx
		.select({
			currentEntryId: unitProgress.currentEntryId,
			progress: unitProgress.progress,
			status: unitProgress.status,
			totalTimeMs: unitProgress.totalTimeMs,
			lastContentStructureNodeId: unitProgress.lastContentStructureNodeId,
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
				eq(contentStructure.kind, "book.contents"),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!node) throw new ContentStructureNodeNotFound();
	return node.revisionId;
}

function validateOccurredAt(occurredAt: Date | null, datePrecision: ProgressDatePrecision): void {
	const isUnknown = datePrecision === "unknown";
	if (isUnknown !== (occurredAt === null) || (occurredAt && Number.isNaN(occurredAt.getTime())))
		throw new ValidationError({
			occurredAt: "occurredAt must be null exactly when datePrecision is unknown",
		});
}

function normalizeEntry(
	input: ProgressEntryWriteInput,
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
	const snapshot = await findProgressSnapshot(tx, profileId, unitId);
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
	const current = await findCurrentEntry(tx, profileId, unitId, preferredCurrentEntryId);
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
		await tx
			.update(unitProgress)
			.set({ currentEntryId: null, deletedAt: new Date(), lastSeenAt: new Date() })
			.where(and(eq(unitProgress.profileId, profileId), eq(unitProgress.unitId, unitId)));
		return;
	}
	const completedCount = toSafeInteger(statistics.completedCount, "progress completion count");
	const [preference] = await tx
		.select({ visibility: profilePreference.progressVisibility })
		.from(profilePreference)
		.where(eq(profilePreference.profileId, profileId))
		.limit(1);
	if (!preference) throw new Error("Progress visibility preference was not found");
	await tx
		.insert(unitProgress)
		.values({
			profileId,
			unitId,
			status: current?.status ?? "backlog",
			progress: current?.progress ?? 0,
			completedCount,
			totalTimeMs: current?.totalTimeMs ?? 0n,
			firstSeenAt: statistics.firstSeenAt,
			lastSeenAt: statistics.lastSeenAt,
			lastContentStructureNodeId: current?.contentStructureNodeId ?? null,
			currentEntryId: current?.id ?? null,
			visibility: preference.visibility,
			deletedAt: null,
		})
		.onConflictDoUpdate({
			target: [unitProgress.profileId, unitProgress.unitId],
			set: {
				status: current?.status ?? "backlog",
				progress: current?.progress ?? 0,
				completedCount,
				totalTimeMs: current?.totalTimeMs ?? 0n,
				firstSeenAt: statistics.firstSeenAt,
				lastSeenAt: statistics.lastSeenAt,
				lastContentStructureNodeId: current?.contentStructureNodeId ?? null,
				currentEntryId: current?.id ?? null,
				deletedAt: null,
			},
		});
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
			sourceKind: input.sourceKind,
			sourceProvider: input.sourceProvider,
			sourceExternalId: input.sourceExternalId,
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
	input: ProgressEntryWriteInput,
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
			sourceKind: input.sourceKind,
			sourceProvider: input.sourceProvider,
			sourceExternalId: input.sourceExternalId,
			affectsCurrent: input.affectsCurrent,
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
	await refreshProgressSnapshot(
		tx,
		profileId,
		unitId,
		input.affectsCurrent ? entry.id : undefined,
	);
	return entry;
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

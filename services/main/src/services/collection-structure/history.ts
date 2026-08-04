import { and, desc, eq, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	collectionStructureRevision,
	collectionStructureRevisionHead,
	revisionContent,
} from "../database/schema";
import {
	findOrCreateRevisionContent,
	materializeStoredRevisionContent,
	revisionPayloadByteSize,
	type StoredRevisionContent,
} from "../history/content";
import { runRevisionedAggregateMutation } from "../history/revisioned-batch";
import { recordStudioWorkRelation } from "../studio/projection";
import {
	CollectionStructureCheckpointDepth,
	CollectionStructureContentModel,
	CollectionStructureDeltaSchema,
	applyCollectionStructureDelta,
	diffCollectionStructureSnapshots,
	parseCollectionStructureSnapshot,
	shouldCheckpointCollectionStructureRevision,
	type CollectionStructureDelta,
	type CollectionStructureSnapshot,
} from "./contracts";
import { CollectionStructureRevisionConflict } from "./errors";
import { loadCollectionStructureSnapshot, restoreCollectionStructureSnapshot } from "./storage";

export type CollectionStructureRevisionKind = "create" | "update" | "restore";

export type CollectionStructureRevisionCommitResult = {
	readonly revisionId: string;
	readonly revisionCreated: boolean;
};

type CollectionStructureRevisionActor = {
	readonly actorProfileId?: string | null;
	readonly message?: string;
	readonly minor?: boolean;
};

function assertSnapshotIdentity(collectionId: string, value: unknown): CollectionStructureSnapshot {
	const state = parseCollectionStructureSnapshot(value);
	if (state.collectionId !== collectionId)
		throw new TypeError("Collection Structure checkpoint contains another Collection");
	return state;
}

function assertDeltaIdentity(collectionId: string, value: unknown): CollectionStructureDelta {
	const delta = CollectionStructureDeltaSchema.parse(value);
	if (delta.collectionId !== collectionId)
		throw new TypeError("Collection Structure delta contains another Collection");
	return delta;
}

async function lockCollectionStructureHistory(
	tx: DatabaseTransaction,
	collectionId: string,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${"collection-structure:" + collectionId}::text, 0))`,
	);
}

async function loadHead(tx: DatabaseTransaction, collectionId: string) {
	const [head] = await tx
		.select({
			revisionId: collectionStructureRevisionHead.revisionId,
			contentId: collectionStructureRevision.contentId,
			replayByteSize: collectionStructureRevision.replayByteSize,
			checkpointByteSize: collectionStructureRevision.checkpointByteSize,
			model: revisionContent.model,
			deltaDepth: revisionContent.deltaDepth,
		})
		.from(collectionStructureRevisionHead)
		.innerJoin(
			collectionStructureRevision,
			eq(collectionStructureRevision.id, collectionStructureRevisionHead.revisionId),
		)
		.innerJoin(revisionContent, eq(revisionContent.id, collectionStructureRevision.contentId))
		.where(eq(collectionStructureRevisionHead.collectionId, collectionId))
		.limit(1);
	if (head && head.model !== CollectionStructureContentModel)
		throw new Error("Collection Structure head uses an unsupported content model");
	return head;
}

async function commitCollectionStructureRevision(
	tx: DatabaseTransaction,
	input: CollectionStructureRevisionActor & {
		readonly collectionId: string;
		readonly revisionKind: CollectionStructureRevisionKind;
		readonly sourceRevisionId?: string;
		readonly expectedRevisionId: string | null;
		readonly checkpoint?: CollectionStructureSnapshot;
		readonly delta?: CollectionStructureDelta;
	},
): Promise<CollectionStructureRevisionCommitResult> {
	const head = await loadHead(tx, input.collectionId);
	if ((head?.revisionId ?? null) !== input.expectedRevisionId)
		throw new CollectionStructureRevisionConflict(head?.revisionId ?? null);
	if ((input.revisionKind === "restore") !== Boolean(input.sourceRevisionId))
		throw new TypeError("Only Collection Structure restore revisions have a source revision");
	if ((input.checkpoint === undefined) === (input.delta === undefined))
		throw new TypeError("A Collection Structure revision needs one content form");

	let checkpointState =
		input.checkpoint === undefined
			? undefined
			: assertSnapshotIdentity(input.collectionId, input.checkpoint);
	const delta =
		input.delta === undefined
			? undefined
			: assertDeltaIdentity(input.collectionId, input.delta);
	const deltaByteSize = delta ? revisionPayloadByteSize(delta) : 0;
	const checkpoint =
		checkpointState !== undefined ||
		!head ||
		(delta !== undefined &&
			shouldCheckpointCollectionStructureRevision({
				currentDeltaDepth: head.deltaDepth,
				currentReplayByteSize: head.replayByteSize,
				checkpointByteSize: head.checkpointByteSize,
				deltaByteSize,
			}));
	if (checkpoint && !checkpointState)
		checkpointState = await loadCollectionStructureSnapshot(tx, input.collectionId);

	let content: StoredRevisionContent;
	let replayByteSize: number;
	let checkpointByteSize: number;
	if (checkpoint) {
		content = await findOrCreateRevisionContent(tx, {
			model: CollectionStructureContentModel,
			payload: checkpointState,
		});
		replayByteSize = 0;
		checkpointByteSize = content.byteSize;
	} else {
		if (!head || !delta)
			throw new TypeError("The first Collection Structure revision must be a checkpoint");
		content = await findOrCreateRevisionContent(
			tx,
			{ model: CollectionStructureContentModel, payload: delta },
			{
				encoding: "delta",
				baseContentId: head.contentId,
				deltaDepth: head.deltaDepth + 1,
			},
		);
		replayByteSize = head.replayByteSize + content.byteSize;
		checkpointByteSize = head.checkpointByteSize;
	}
	const [revision] = await tx
		.insert(collectionStructureRevision)
		.values({
			collectionId: input.collectionId,
			parentRevisionId: head?.revisionId ?? null,
			sourceRevisionId: input.sourceRevisionId ?? null,
			contentId: content.id,
			actorProfileId: input.actorProfileId,
			editSummary: input.message,
			kind: input.revisionKind,
			minor: input.minor ?? false,
			replayByteSize,
			checkpointByteSize,
		})
		.returning({
			id: collectionStructureRevision.id,
			createdAt: collectionStructureRevision.createdAt,
		});
	if (!revision) throw new Error("Collection Structure revision insertion returned no id");
	await tx
		.insert(collectionStructureRevisionHead)
		.values({ collectionId: input.collectionId, revisionId: revision.id })
		.onConflictDoUpdate({
			target: collectionStructureRevisionHead.collectionId,
			set: { revisionId: revision.id },
		});
	await recordStudioWorkRelation(tx, {
		profileId: input.actorProfileId,
		relation: "contributed",
		source: "collection_structure_revision",
		occurredAt: revision.createdAt,
		target: {
			kind: "unit_contribution",
			unitId: input.collectionId,
			authorizationScope: ["collection", "items"],
		},
	});
	return { revisionId: revision.id, revisionCreated: true };
}

export async function createCollectionStructureHistory(
	tx: DatabaseTransaction,
	input: CollectionStructureRevisionActor & {
		readonly collectionId: string;
	},
): Promise<CollectionStructureRevisionCommitResult> {
	await lockCollectionStructureHistory(tx, input.collectionId);
	return commitCollectionStructureRevision(tx, {
		...input,
		revisionKind: "create",
		expectedRevisionId: null,
		checkpoint: await loadCollectionStructureSnapshot(tx, input.collectionId),
	});
}

export async function mutateCollectionStructureWithHistory<Result extends object>(
	tx: DatabaseTransaction,
	input: CollectionStructureRevisionActor & {
		readonly collectionId: string;
		readonly baseRevisionId: string;
	},
	mutate: () => Promise<Result>,
): Promise<Result & CollectionStructureRevisionCommitResult> {
	return mutateCollectionStructureWithPlannedHistory(tx, input, async () => {
		const before = await loadCollectionStructureSnapshot(tx, input.collectionId);
		const result = await mutate();
		const after = await loadCollectionStructureSnapshot(tx, input.collectionId);
		return {
			result,
			change: diffCollectionStructureSnapshots(before, after) ?? undefined,
		};
	});
}

/** Commits a Collection mutation whose semantic delta was produced by its planner. */
export async function mutateCollectionStructureWithPlannedHistory<Result extends object>(
	tx: DatabaseTransaction,
	input: CollectionStructureRevisionActor & {
		readonly collectionId: string;
		readonly baseRevisionId: string;
	},
	mutate: () => Promise<{
		readonly result: Result;
		readonly change?: CollectionStructureDelta;
	}>,
): Promise<Result & CollectionStructureRevisionCommitResult> {
	return runRevisionedAggregateMutation({
		expectedRevisionId: input.baseRevisionId,
		lock: () => lockCollectionStructureHistory(tx, input.collectionId),
		loadHeadRevisionId: async () =>
			(await loadHead(tx, input.collectionId))?.revisionId ?? null,
		revisionConflict: (latestRevisionId) =>
			new CollectionStructureRevisionConflict(latestRevisionId),
		mutate,
		commit: (delta) =>
			commitCollectionStructureRevision(tx, {
				...input,
				revisionKind: "update",
				expectedRevisionId: input.baseRevisionId,
				delta,
			}),
		unchanged: (revisionId) => ({ revisionId, revisionCreated: false }),
	});
}

export async function getCollectionStructureHeadRevision(
	tx: DatabaseTransaction,
	collectionId: string,
): Promise<string | null> {
	return (await loadHead(tx, collectionId))?.revisionId ?? null;
}

export async function getCollectionStructureRevisionState(
	tx: DatabaseTransaction,
	input: { readonly collectionId: string; readonly revisionId: string },
): Promise<CollectionStructureSnapshot> {
	const [revision] = await tx
		.select({ contentId: collectionStructureRevision.contentId })
		.from(collectionStructureRevision)
		.where(
			and(
				eq(collectionStructureRevision.id, input.revisionId),
				eq(collectionStructureRevision.collectionId, input.collectionId),
			),
		)
		.limit(1);
	if (!revision)
		throw new CollectionStructureRevisionConflict(
			await getCollectionStructureHeadRevision(tx, input.collectionId),
		);
	const materialized = await materializeStoredRevisionContent(tx, revision.contentId, {
		maxDeltaDepth: CollectionStructureCheckpointDepth,
		applyDelta: (model, base, delta) => {
			if (model !== CollectionStructureContentModel)
				throw new Error(`Unsupported Collection Structure revision model ${model}`);
			return applyCollectionStructureDelta(base, delta);
		},
	});
	if (materialized.model !== CollectionStructureContentModel)
		throw new Error("Collection Structure revision uses an unsupported content model");
	return assertSnapshotIdentity(input.collectionId, materialized.payload);
}

export async function restoreCollectionStructureRevision(
	tx: DatabaseTransaction,
	input: CollectionStructureRevisionActor & {
		readonly collectionId: string;
		readonly sourceRevisionId: string;
		readonly baseRevisionId: string;
	},
): Promise<CollectionStructureRevisionCommitResult> {
	await lockCollectionStructureHistory(tx, input.collectionId);
	const head = await loadHead(tx, input.collectionId);
	if ((head?.revisionId ?? null) !== input.baseRevisionId)
		throw new CollectionStructureRevisionConflict(head?.revisionId ?? null);
	const state = await getCollectionStructureRevisionState(tx, {
		collectionId: input.collectionId,
		revisionId: input.sourceRevisionId,
	});
	await restoreCollectionStructureSnapshot(tx, input.collectionId, state);
	const restoredState = await loadCollectionStructureSnapshot(tx, input.collectionId);
	return commitCollectionStructureRevision(tx, {
		...input,
		revisionKind: "restore",
		expectedRevisionId: input.baseRevisionId,
		checkpoint: restoredState,
	});
}

export async function listCollectionStructureRevisions(
	tx: DatabaseTransaction,
	collectionId: string,
	limit = 50,
) {
	return tx
		.select({
			id: collectionStructureRevision.id,
			parentRevisionId: collectionStructureRevision.parentRevisionId,
			sourceRevisionId: collectionStructureRevision.sourceRevisionId,
			actorProfileId: collectionStructureRevision.actorProfileId,
			kind: collectionStructureRevision.kind,
			editSummary: collectionStructureRevision.editSummary,
			minor: collectionStructureRevision.minor,
			replayByteSize: collectionStructureRevision.replayByteSize,
			checkpointByteSize: collectionStructureRevision.checkpointByteSize,
			createdAt: collectionStructureRevision.createdAt,
		})
		.from(collectionStructureRevision)
		.where(eq(collectionStructureRevision.collectionId, collectionId))
		.orderBy(desc(collectionStructureRevision.createdAt), desc(collectionStructureRevision.id))
		.limit(limit);
}

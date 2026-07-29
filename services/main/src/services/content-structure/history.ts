import { and, desc, eq, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructureRevision,
	contentStructureRevisionHead,
	revisionContent,
} from "../database/schema";
import {
	findOrCreateRevisionContent,
	materializeStoredRevisionContent,
	revisionPayloadByteSize,
	type StoredRevisionContent,
} from "../history/content";
import { recordStudioWorkRelation } from "../studio/projection";
import {
	ContentStructureCheckpointDepth,
	ContentStructureContentModel,
	ContentStructureDeltaSchema,
	ContentStructureLogicalStateSchema,
	applyContentStructureDelta,
	shouldCheckpointContentStructureRevision,
	type ContentStructureDelta,
	type ContentStructureLogicalState,
} from "./contracts";
import { ContentStructureRevisionConflict } from "./errors";
import { loadContentStructureSnapshot, restoreContentStructureState } from "./storage";

export type ContentStructureRevisionKind = "create" | "update" | "delete" | "restore";

export type ContentStructureRevisionCommitResult = {
	readonly revisionId: string;
	readonly revisionCreated: boolean;
};

type ContentStructureRevisionActor = {
	readonly actorProfileId?: string | null;
	readonly message?: string;
	readonly minor?: boolean;
};

export type ContentStructureHistoryChange =
	| {
			readonly kind: "checkpoint";
			readonly state: unknown;
	  }
	| {
			readonly kind: "delta";
			readonly delta: unknown;
			readonly checkpoint: () => Promise<unknown>;
			readonly forceCheckpoint?: boolean;
	  };

function assertStateIdentity(structureId: string, value: unknown): ContentStructureLogicalState {
	const state = ContentStructureLogicalStateSchema.parse(value);
	const payloadStructureId = "deleted" in state ? state.structureId : state.structure.id;
	if (payloadStructureId !== structureId)
		throw new TypeError("Content Structure checkpoint contains another structure");
	return state;
}

function assertDeltaIdentity(structureId: string, value: unknown): ContentStructureDelta {
	const delta = ContentStructureDeltaSchema.parse(value);
	if (delta.structureId !== structureId)
		throw new TypeError("Content Structure delta contains another structure");
	return delta;
}

async function lockContentStructureHistory(
	tx: DatabaseTransaction,
	structureId: string,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${"content-structure:" + structureId}::text, 0))`,
	);
}

async function loadHead(tx: DatabaseTransaction, structureId: string) {
	const [head] = await tx
		.select({
			revisionId: contentStructureRevisionHead.revisionId,
			contentId: contentStructureRevision.contentId,
			replayByteSize: contentStructureRevision.replayByteSize,
			checkpointByteSize: contentStructureRevision.checkpointByteSize,
			model: revisionContent.model,
			deltaDepth: revisionContent.deltaDepth,
		})
		.from(contentStructureRevisionHead)
		.innerJoin(
			contentStructureRevision,
			eq(contentStructureRevision.id, contentStructureRevisionHead.revisionId),
		)
		.innerJoin(revisionContent, eq(revisionContent.id, contentStructureRevision.contentId))
		.where(eq(contentStructureRevisionHead.structureId, structureId))
		.limit(1);
	if (head && head.model !== ContentStructureContentModel)
		throw new Error("Content Structure head uses an unsupported content model");
	return head;
}

async function commitContentStructureRevision(
	tx: DatabaseTransaction,
	input: ContentStructureRevisionActor & {
		readonly structureId: string;
		readonly revisionKind: ContentStructureRevisionKind;
		readonly sourceRevisionId?: string;
		readonly expectedRevisionId: string | null;
		readonly change: ContentStructureHistoryChange;
	},
): Promise<ContentStructureRevisionCommitResult> {
	const head = await loadHead(tx, input.structureId);
	if ((head?.revisionId ?? null) !== input.expectedRevisionId)
		throw new ContentStructureRevisionConflict(head?.revisionId ?? null);
	if ((input.revisionKind === "restore") !== Boolean(input.sourceRevisionId))
		throw new TypeError("Only Content Structure restore revisions have a source revision");

	let checkpoint: boolean;
	let delta: ContentStructureDelta | undefined;
	let checkpointState: ContentStructureLogicalState | undefined;
	let deltaByteSize = 0;
	if (input.change.kind === "checkpoint") {
		checkpoint = true;
		checkpointState = assertStateIdentity(input.structureId, input.change.state);
	} else {
		delta = assertDeltaIdentity(input.structureId, input.change.delta);
		deltaByteSize = revisionPayloadByteSize(delta);
		checkpoint =
			!head ||
			shouldCheckpointContentStructureRevision({
				currentDeltaDepth: head.deltaDepth,
				currentReplayByteSize: head.replayByteSize,
				checkpointByteSize: head.checkpointByteSize,
				deltaByteSize,
				forceCheckpoint: input.change.forceCheckpoint,
			});
		if (checkpoint)
			checkpointState = assertStateIdentity(
				input.structureId,
				await input.change.checkpoint(),
			);
	}

	let content: StoredRevisionContent;
	let replayByteSize: number;
	let checkpointByteSize: number;
	if (checkpoint) {
		content = await findOrCreateRevisionContent(tx, {
			model: ContentStructureContentModel,
			payload: checkpointState,
		});
		replayByteSize = 0;
		checkpointByteSize = content.byteSize;
	} else {
		if (!head || !delta)
			throw new TypeError("The first Content Structure revision must be a checkpoint");
		content = await findOrCreateRevisionContent(
			tx,
			{ model: ContentStructureContentModel, payload: delta },
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
		.insert(contentStructureRevision)
		.values({
			structureId: input.structureId,
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
			id: contentStructureRevision.id,
			createdAt: contentStructureRevision.createdAt,
		});
	if (!revision) throw new Error("Content Structure revision insertion returned no id");
	await tx
		.insert(contentStructureRevisionHead)
		.values({ structureId: input.structureId, revisionId: revision.id })
		.onConflictDoUpdate({
			target: contentStructureRevisionHead.structureId,
			set: { revisionId: revision.id },
		});
	await recordStudioWorkRelation(tx, {
		profileId: input.actorProfileId,
		relation: "contributed",
		source: "content_structure_revision",
		occurredAt: revision.createdAt,
		target: { kind: "content_structure", structureId: input.structureId },
	});
	return { revisionId: revision.id, revisionCreated: true };
}

export async function createContentStructureHistory(
	tx: DatabaseTransaction,
	input: ContentStructureRevisionActor & {
		readonly structureId: string;
		readonly state: unknown;
	},
): Promise<ContentStructureRevisionCommitResult> {
	await lockContentStructureHistory(tx, input.structureId);
	return commitContentStructureRevision(tx, {
		...input,
		revisionKind: "create",
		expectedRevisionId: null,
		change: { kind: "checkpoint", state: input.state },
	});
}

export async function mutateContentStructureWithHistory<Result extends object>(
	tx: DatabaseTransaction,
	input: ContentStructureRevisionActor & {
		readonly structureId: string;
		readonly baseRevisionId: string;
		readonly revisionKind?: "update" | "delete";
	},
	mutate: () => Promise<{
		readonly result: Result;
		readonly change?: ContentStructureHistoryChange;
	}>,
): Promise<Result & ContentStructureRevisionCommitResult> {
	await lockContentStructureHistory(tx, input.structureId);
	const head = await loadHead(tx, input.structureId);
	if ((head?.revisionId ?? null) !== input.baseRevisionId)
		throw new ContentStructureRevisionConflict(head?.revisionId ?? null);
	const outcome = await mutate();
	if (!outcome.change)
		return {
			...outcome.result,
			revisionId: input.baseRevisionId,
			revisionCreated: false,
		};
	const revision = await commitContentStructureRevision(tx, {
		...input,
		revisionKind: input.revisionKind ?? "update",
		expectedRevisionId: input.baseRevisionId,
		change: outcome.change,
	});
	return { ...outcome.result, ...revision };
}

export async function getContentStructureHeadRevision(
	tx: DatabaseTransaction,
	structureId: string,
): Promise<string | null> {
	return (await loadHead(tx, structureId))?.revisionId ?? null;
}

export async function getContentStructureRevisionState(
	tx: DatabaseTransaction,
	input: { readonly structureId: string; readonly revisionId: string },
): Promise<ContentStructureLogicalState> {
	const [revision] = await tx
		.select({ contentId: contentStructureRevision.contentId })
		.from(contentStructureRevision)
		.where(
			and(
				eq(contentStructureRevision.id, input.revisionId),
				eq(contentStructureRevision.structureId, input.structureId),
			),
		)
		.limit(1);
	if (!revision)
		throw new ContentStructureRevisionConflict(
			await getContentStructureHeadRevision(tx, input.structureId),
		);
	const materialized = await materializeStoredRevisionContent(tx, revision.contentId, {
		maxDeltaDepth: ContentStructureCheckpointDepth,
		applyDelta: (model, base, delta) => {
			if (model !== ContentStructureContentModel)
				throw new Error(`Unsupported Content Structure revision model ${model}`);
			return applyContentStructureDelta(base, delta);
		},
	});
	if (materialized.model !== ContentStructureContentModel)
		throw new Error("Content Structure revision uses an unsupported content model");
	return assertStateIdentity(input.structureId, materialized.payload);
}

export async function restoreContentStructureRevision(
	tx: DatabaseTransaction,
	input: ContentStructureRevisionActor & {
		readonly structureId: string;
		readonly sourceRevisionId: string;
		readonly baseRevisionId: string;
	},
): Promise<ContentStructureRevisionCommitResult> {
	await lockContentStructureHistory(tx, input.structureId);
	const head = await loadHead(tx, input.structureId);
	if ((head?.revisionId ?? null) !== input.baseRevisionId)
		throw new ContentStructureRevisionConflict(head?.revisionId ?? null);
	const state = await getContentStructureRevisionState(tx, {
		structureId: input.structureId,
		revisionId: input.sourceRevisionId,
	});
	await restoreContentStructureState(tx, input.structureId, state);
	// Database defaults and invariant triggers may normalize older revision
	// payloads during restore. Commit the normalized physical state so the new
	// head remains a valid base for the next semantic delta.
	const restoredState =
		"deleted" in state
			? state
			: await loadContentStructureSnapshot(tx, {
					structureId: input.structureId,
				});
	return commitContentStructureRevision(tx, {
		...input,
		revisionKind: "restore",
		expectedRevisionId: input.baseRevisionId,
		change: { kind: "checkpoint", state: restoredState },
	});
}

export async function listContentStructureRevisions(
	tx: DatabaseTransaction,
	structureId: string,
	limit = 50,
) {
	return tx
		.select({
			id: contentStructureRevision.id,
			parentRevisionId: contentStructureRevision.parentRevisionId,
			sourceRevisionId: contentStructureRevision.sourceRevisionId,
			actorProfileId: contentStructureRevision.actorProfileId,
			kind: contentStructureRevision.kind,
			editSummary: contentStructureRevision.editSummary,
			minor: contentStructureRevision.minor,
			replayByteSize: contentStructureRevision.replayByteSize,
			checkpointByteSize: contentStructureRevision.checkpointByteSize,
			createdAt: contentStructureRevision.createdAt,
		})
		.from(contentStructureRevision)
		.where(eq(contentStructureRevision.structureId, structureId))
		.orderBy(desc(contentStructureRevision.createdAt), desc(contentStructureRevision.id))
		.limit(limit);
}

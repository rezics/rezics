import { and, desc, eq, sql } from "drizzle-orm";
import {
	DockBlockHostPolicy,
	DockDocument,
	assertBlockQueryBudget,
	parseDocument,
} from "@rezics/block";

import type { DatabaseTransaction } from "../../database";
import { dockRevision, dockRevisionHead, revisionContent, unitDock } from "../../database/schema";
import {
	findOrCreateRevisionContent,
	materializeStoredRevisionContent,
} from "../../history/content";
import { recordProfileResourceParticipation } from "../../history/participation";
import { DockRevisionConflict } from "./errors";

export const DockContentModel = "rezics.dock.v1" as const;

type DockRecord = typeof unitDock.$inferSelect;
type DockState = {
	readonly id: string;
	readonly unitId: string;
	readonly kind: "main" | "wiki";
	readonly document: typeof DockDocument.static;
	readonly deletedAt: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
};
type DockLogicalState =
	| { readonly version: 1; readonly dock: DockState }
	| { readonly version: 1; readonly deleted: true; readonly dockId: string };

const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function dockStateFromRecord(dock: DockRecord): DockState {
	return {
		id: dock.id,
		unitId: dock.unitId,
		kind: dock.kind,
		document: parseDocument(DockDocument, dock.document),
		deletedAt: dock.deletedAt?.toISOString() ?? null,
		createdAt: dock.createdAt.toISOString(),
		updatedAt: dock.updatedAt.toISOString(),
	};
}

function assertDockState(dockId: string, value: unknown): DockLogicalState {
	if (!value || typeof value !== "object") throw new TypeError("Invalid Dock checkpoint");
	const state = value as Record<string, unknown>;
	if (state.version !== 1) throw new TypeError("Unsupported Dock checkpoint version");
	if (state.deleted === true) {
		if (state.dockId !== dockId) throw new TypeError("Dock checkpoint has another identity");
		return { version: 1, deleted: true, dockId };
	}
	if (!state.dock || typeof state.dock !== "object" || Array.isArray(state.dock))
		throw new TypeError("Dock checkpoint has no Dock record");
	const candidate = state.dock as Record<string, unknown>;
	if (
		candidate.id !== dockId ||
		typeof candidate.unitId !== "string" ||
		!UuidPattern.test(candidate.unitId) ||
		(candidate.kind !== "main" && candidate.kind !== "wiki") ||
		(candidate.deletedAt !== null && typeof candidate.deletedAt !== "string") ||
		typeof candidate.createdAt !== "string" ||
		typeof candidate.updatedAt !== "string"
	)
		throw new TypeError("Dock checkpoint has an invalid record");
	const dock: DockState = {
		id: dockId,
		unitId: candidate.unitId,
		kind: candidate.kind,
		document: parseDocument(DockDocument, candidate.document),
		deletedAt: candidate.deletedAt,
		createdAt: candidate.createdAt,
		updatedAt: candidate.updatedAt,
	};
	return { version: 1, dock };
}

export async function lockDockHistory(tx: DatabaseTransaction, dockId: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`dock:${dockId}`}::text, 0))`,
	);
}

async function loadDockHead(tx: DatabaseTransaction, dockId: string) {
	const [head] = await tx
		.select({
			revisionId: dockRevisionHead.revisionId,
			contentId: dockRevision.contentId,
			model: revisionContent.model,
		})
		.from(dockRevisionHead)
		.innerJoin(dockRevision, eq(dockRevision.id, dockRevisionHead.revisionId))
		.innerJoin(revisionContent, eq(revisionContent.id, dockRevision.contentId))
		.where(eq(dockRevisionHead.dockId, dockId))
		.limit(1);
	if (head && head.model !== DockContentModel)
		throw new Error("Dock head uses an unsupported content model");
	return head;
}

async function commitDockRevision(
	tx: DatabaseTransaction,
	input: {
		readonly dockId: string;
		readonly expectedRevisionId: string | null;
		readonly actorProfileId?: string | null;
		readonly kind: "create" | "update" | "delete" | "restore";
		readonly sourceRevisionId?: string;
		readonly message?: string;
		readonly state: unknown;
	},
) {
	const head = await loadDockHead(tx, input.dockId);
	if ((head?.revisionId ?? null) !== input.expectedRevisionId)
		throw new DockRevisionConflict(head?.revisionId ?? null);
	if ((input.kind === "restore") !== Boolean(input.sourceRevisionId))
		throw new TypeError("Only Dock restore revisions have a source revision");
	const state = assertDockState(input.dockId, input.state);
	const content = await findOrCreateRevisionContent(tx, {
		model: DockContentModel,
		payload: state,
	});
	const [revision] = await tx
		.insert(dockRevision)
		.values({
			dockId: input.dockId,
			parentRevisionId: head?.revisionId ?? null,
			sourceRevisionId: input.sourceRevisionId ?? null,
			contentId: content.id,
			actorProfileId: input.actorProfileId,
			editSummary: input.message,
			kind: input.kind,
		})
		.returning({ id: dockRevision.id, createdAt: dockRevision.createdAt });
	if (!revision) throw new Error("Dock revision insertion returned no id");
	await tx
		.insert(dockRevisionHead)
		.values({ dockId: input.dockId, revisionId: revision.id })
		.onConflictDoUpdate({
			target: dockRevisionHead.dockId,
			set: { revisionId: revision.id },
		});
	await recordProfileResourceParticipation(tx, {
		profileId: input.actorProfileId,
		relation: "contributed",
		occurredAt: revision.createdAt,
		target: { kind: "dock", dockId: input.dockId },
	});
	return { revisionId: revision.id, revisionCreated: true as const };
}

export async function createDockHistory(
	tx: DatabaseTransaction,
	input: { readonly dock: DockRecord; readonly actorProfileId?: string | null },
) {
	await lockDockHistory(tx, input.dock.id);
	return commitDockRevision(tx, {
		dockId: input.dock.id,
		expectedRevisionId: null,
		actorProfileId: input.actorProfileId,
		kind: "create",
		state: { version: 1, dock: dockStateFromRecord(input.dock) },
	});
}

export async function updateDockHistory(
	tx: DatabaseTransaction,
	input: {
		readonly dock: DockRecord;
		readonly baseRevisionId: string;
		readonly actorProfileId?: string | null;
	},
) {
	await lockDockHistory(tx, input.dock.id);
	return commitDockRevision(tx, {
		dockId: input.dock.id,
		expectedRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		kind: "update",
		state: { version: 1, dock: dockStateFromRecord(input.dock) },
	});
}

export async function deleteDockHistory(
	tx: DatabaseTransaction,
	input: {
		readonly dockId: string;
		readonly baseRevisionId: string;
		readonly actorProfileId?: string | null;
	},
) {
	await lockDockHistory(tx, input.dockId);
	return commitDockRevision(tx, {
		dockId: input.dockId,
		expectedRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		kind: "delete",
		state: { version: 1, deleted: true, dockId: input.dockId },
	});
}

export async function getDockRevisionId(
	tx: DatabaseTransaction,
	dockId: string,
): Promise<string | null> {
	return (await loadDockHead(tx, dockId))?.revisionId ?? null;
}

export async function listDockRevisions(tx: DatabaseTransaction, dockId: string, limit = 50) {
	return tx
		.select({
			id: dockRevision.id,
			parentRevisionId: dockRevision.parentRevisionId,
			sourceRevisionId: dockRevision.sourceRevisionId,
			actorProfileId: dockRevision.actorProfileId,
			kind: dockRevision.kind,
			editSummary: dockRevision.editSummary,
			createdAt: dockRevision.createdAt,
		})
		.from(dockRevision)
		.where(eq(dockRevision.dockId, dockId))
		.orderBy(desc(dockRevision.createdAt), desc(dockRevision.id))
		.limit(limit);
}

export async function getDockRevisionState(
	tx: DatabaseTransaction,
	input: { readonly dockId: string; readonly revisionId: string },
): Promise<DockLogicalState> {
	const [revision] = await tx
		.select({ contentId: dockRevision.contentId })
		.from(dockRevision)
		.where(and(eq(dockRevision.id, input.revisionId), eq(dockRevision.dockId, input.dockId)))
		.limit(1);
	if (!revision) throw new DockRevisionConflict(await getDockRevisionId(tx, input.dockId));
	const content = await materializeStoredRevisionContent(tx, revision.contentId, {
		maxDeltaDepth: 0,
		applyDelta: (model) => {
			throw new Error(`Unsupported Dock delta model ${model}`);
		},
	});
	if (content.model !== DockContentModel)
		throw new Error("Dock revision uses an unsupported content model");
	return assertDockState(input.dockId, content.payload);
}

export async function restoreDockRevision(
	tx: DatabaseTransaction,
	input: {
		readonly dockId: string;
		readonly sourceRevisionId: string;
		readonly baseRevisionId: string;
		readonly actorProfileId?: string | null;
		readonly validateDocument?: (document: typeof DockDocument.static) => Promise<void>;
	},
) {
	await lockDockHistory(tx, input.dockId);
	const head = await loadDockHead(tx, input.dockId);
	if ((head?.revisionId ?? null) !== input.baseRevisionId)
		throw new DockRevisionConflict(head?.revisionId ?? null);
	const state = await getDockRevisionState(tx, {
		dockId: input.dockId,
		revisionId: input.sourceRevisionId,
	});
	const [current] = await tx.select().from(unitDock).where(eq(unitDock.id, input.dockId)).limit(1);
	if (!current) throw new DockRevisionConflict(head?.revisionId ?? null);
	let restoredState: DockLogicalState;
	if ("deleted" in state) {
		await tx
			.update(unitDock)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(eq(unitDock.id, input.dockId));
		restoredState = state;
	} else {
		if (state.dock.unitId !== current.unitId || state.dock.kind !== current.kind)
			throw new TypeError("Dock restore cannot change its owner or kind");
		if (input.validateDocument) await input.validateDocument(state.dock.document);
		else assertBlockQueryBudget(state.dock.document, DockBlockHostPolicy);
		const [restored] = await tx
			.update(unitDock)
			.set({ document: state.dock.document, deletedAt: null, updatedAt: new Date() })
			.where(eq(unitDock.id, input.dockId))
			.returning();
		if (!restored) throw new Error("Dock restore returned no row");
		restoredState = { version: 1, dock: dockStateFromRecord(restored) };
	}
	return commitDockRevision(tx, {
		dockId: input.dockId,
		expectedRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		kind: "restore",
		sourceRevisionId: input.sourceRevisionId,
		state: restoredState,
	});
}

import { and, asc, eq, getTableColumns, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	contentStructureRevisionHead,
	type ContentStructureKind,
	type RealmTagQueryStrategy,
} from "../database/schema";
import {
	ContentStructureSnapshotSchema,
	diffContentStructureSnapshots,
	type ContentStructureNodeState,
	type ContentStructureTarget,
} from "./contracts";
import { applyContentStructureBatch } from "./batch";
import type { ContentStructureBatchCommand } from "./batch-plan";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";
import { createContentStructureHistory, mutateContentStructureWithHistory } from "./history";
import { ensureContentStructureKindOwner, loadContentStructureSnapshot } from "./storage";

type MutationActor = {
	readonly actorProfileId: string;
	readonly message?: string;
	readonly minor?: boolean;
};

type ExistingStructureMutation = MutationActor & {
	readonly ownerUnitId: string;
	readonly structureId: string;
	readonly baseRevisionId: string;
};

const SingletonContentStructureKinds = new Set<ContentStructureKind>([
	"book.contents",
	"media.contents",
	"post.contents",
	"realm.taxonomy",
	"page-structure",
]);

function ensureDirectContentStructureEditing(kind: ContentStructureKind): void {
	if (kind === "wiki.navigation" || kind === "zone.navigation")
		throw new ContentStructureInvalid(
			"Navigation structures must be edited through the NavigationDocument adapter",
		);
}

/** Serializes singleton Content Structure creation for one owner and kind. @internal */
export async function lockContentStructureOwnerKind(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind: ContentStructureKind,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${"content-structure-owner:" + ownerUnitId + ":" + kind}::text, 0))`,
	);
}

export async function getContentStructureRevision(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	structureId: string,
): Promise<string | null> {
	const [owned] = await tx
		.select({ revisionId: contentStructureRevisionHead.revisionId })
		.from(contentStructure)
		.innerJoin(
			contentStructureRevisionHead,
			eq(contentStructureRevisionHead.structureId, contentStructure.id),
		)
		.where(
			and(
				eq(contentStructure.id, structureId),
				eq(contentStructure.ownerUnitId, ownerUnitId),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	return owned?.revisionId ?? null;
}

export async function listContentStructures(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind?: ContentStructureKind,
) {
	return tx
		.select({
			...getTableColumns(contentStructure),
			latestRevisionId: contentStructureRevisionHead.revisionId,
		})
		.from(contentStructure)
		.innerJoin(
			contentStructureRevisionHead,
			eq(contentStructureRevisionHead.structureId, contentStructure.id),
		)
		.where(
			and(
				eq(contentStructure.ownerUnitId, ownerUnitId),
				kind ? eq(contentStructure.kind, kind) : undefined,
				isNull(contentStructure.deletedAt),
			),
		)
		.orderBy(asc(contentStructure.kind), asc(contentStructure.createdAt), asc(contentStructure.id));
}

export async function createContentStructure(
	tx: DatabaseTransaction,
	input: MutationActor & {
		readonly structureId?: string;
		readonly ownerUnitId: string;
		readonly kind: ContentStructureKind;
		readonly documentKey?: string | null;
	},
) {
	await ensureContentStructureKindOwner(tx, input.ownerUnitId, input.kind);
	ensureDirectContentStructureEditing(input.kind);
	if (input.documentKey != null)
		throw new ContentStructureInvalid("Non-navigation structures cannot have a document key");
	await lockContentStructureOwnerKind(tx, input.ownerUnitId, input.kind);
	if (SingletonContentStructureKinds.has(input.kind)) {
		const [existing] = await tx
			.select({ id: contentStructure.id })
			.from(contentStructure)
			.where(
				and(
					eq(contentStructure.ownerUnitId, input.ownerUnitId),
					eq(contentStructure.kind, input.kind),
					isNull(contentStructure.deletedAt),
				),
			)
			.limit(1);
		if (existing) throw new ContentStructureInvalid(`${input.kind} already exists for this Unit`);
	}
	const [created] = await tx
		.insert(contentStructure)
		.values({
			id: input.structureId,
			ownerUnitId: input.ownerUnitId,
			kind: input.kind,
			documentKey: input.documentKey ?? null,
		})
		.returning();
	if (!created) throw new Error("Content Structure insertion returned no row");
	const snapshot = ContentStructureSnapshotSchema.parse({
		version: 1,
		structure: created,
		nodes: [],
	});
	const revision = await createContentStructureHistory(tx, {
		structureId: created.id,
		actorProfileId: input.actorProfileId,
		message: input.message,
		minor: input.minor,
		state: snapshot,
	});
	return { structure: created, ...revision };
}

async function generateUuidv7(tx: DatabaseTransaction): Promise<string> {
	type GeneratedUuidRow = { readonly id: string };
	const generated = await tx.execute<GeneratedUuidRow>(sql`select uuidv7() as id`);
	const id = generated.rows[0]?.id;
	if (!id) throw new Error("UUIDv7 generation returned no id");
	return id;
}

export async function insertContentStructureNode(
	tx: DatabaseTransaction,
	input: ExistingStructureMutation & {
		readonly parentId?: string | null;
		readonly contentUnitId: string;
		readonly documentKey?: string | null;
		readonly target?: ContentStructureTarget;
		readonly position?: string;
		readonly contentRating?: ContentStructureNodeState["contentRating"];
		readonly realmTagQueryStrategy?: RealmTagQueryStrategy;
	},
) {
	const nodeId = await generateUuidv7(tx);
	const result = await applyContentStructureBatch(tx, {
		ownerUnitId: input.ownerUnitId,
		structureId: input.structureId,
		baseRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		message: input.message,
		minor: input.minor,
		commands: () => {
			return [
				{
					opId: "insert",
					type: "node.create",
					nodeId,
					parentId: input.parentId ?? null,
					contentUnitId: input.contentUnitId,
					documentKey: input.documentKey,
					target: input.target,
					position: input.position,
					contentRating: input.contentRating,
					realmTagQueryStrategy: input.realmTagQueryStrategy,
				},
			];
		},
	});
	const node = result.afterSnapshot.nodes.find(({ id }) => id === nodeId);
	if (!node) throw new Error("Content Structure batch did not create its planned node");
	return { node, revisionId: result.revisionId, revisionCreated: result.revisionCreated };
}

export async function updateContentStructureNode(
	tx: DatabaseTransaction,
	input: ExistingStructureMutation & {
		readonly nodeId: string;
		readonly parentId?: string | null;
		readonly contentUnitId?: string;
		readonly documentKey?: string | null;
		readonly target?: ContentStructureTarget;
		readonly position?: string;
		readonly contentRating?: ContentStructureNodeState["contentRating"];
		readonly realmTagQueryStrategy?: RealmTagQueryStrategy;
	},
) {
	const result = await applyContentStructureBatch(tx, {
		ownerUnitId: input.ownerUnitId,
		structureId: input.structureId,
		baseRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		message: input.message,
		minor: input.minor,
		commands: (snapshot) => {
			const current = snapshot.nodes.find(({ id }) => id === input.nodeId);
			if (!current) throw new ContentStructureNotFound();
			const changes: ContentStructureBatchCommand[] = [];
			const dataRequested =
				input.contentUnitId !== undefined ||
				input.documentKey !== undefined ||
				input.target !== undefined ||
				input.contentRating !== undefined ||
				input.realmTagQueryStrategy !== undefined;
			if (dataRequested) {
				changes.push({
					opId: "update",
					type: "node.update",
					nodeId: input.nodeId,
					contentUnitId: input.contentUnitId,
					documentKey: input.documentKey,
					target: input.target,
					contentRating: input.contentRating,
					realmTagQueryStrategy: input.realmTagQueryStrategy,
				});
			}
			if (input.parentId !== undefined || input.position !== undefined)
				changes.push({
					opId: "move",
					type: "node.move",
					nodeId: input.nodeId,
					parentId: input.parentId,
					position: input.position,
				});
			if (!changes.length)
				changes.push({ opId: "update", type: "node.update", nodeId: input.nodeId });
			return changes;
		},
	});
	const node = result.afterSnapshot.nodes.find(({ id }) => id === input.nodeId);
	if (!node) throw new Error("Content Structure batch lost its updated node");
	return { node, revisionId: result.revisionId, revisionCreated: result.revisionCreated };
}

export async function deleteContentStructureNode(
	tx: DatabaseTransaction,
	input: ExistingStructureMutation & { readonly nodeId: string },
) {
	const result = await applyContentStructureBatch(tx, {
		ownerUnitId: input.ownerUnitId,
		structureId: input.structureId,
		baseRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		message: input.message,
		minor: input.minor,
		commands: [{ opId: "delete", type: "node.deleteSubtree", nodeId: input.nodeId }],
	});
	return {
		deletedNodeIds: result.deletedNodeIds,
		revisionId: result.revisionId,
		revisionCreated: result.revisionCreated,
	};
}

export async function deleteContentStructure(
	tx: DatabaseTransaction,
	input: ExistingStructureMutation &
		(
			| { readonly binding: "direct" }
			| {
					readonly binding: "navigation";
					readonly kind: "wiki.navigation" | "zone.navigation";
			  }
		),
) {
	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: input.structureId,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
			revisionKind: "delete",
			message: input.message,
			minor: input.minor,
		},
		async () => {
			const before = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
			if (input.binding === "direct") ensureDirectContentStructureEditing(before.structure.kind);
			else if (before.structure.kind !== input.kind) throw new ContentStructureNotFound();
			if (input.binding === "direct" && before.structure.kind === "realm.taxonomy")
				throw new ContentStructureInvalid(
					"A Realm taxonomy is a required Realm resource and cannot be deleted",
				);
			const deletedAt = new Date();
			await tx
				.update(contentStructureNode)
				.set({ deletedAt })
				.where(eq(contentStructureNode.structureId, input.structureId));
			await tx
				.update(contentStructure)
				.set({ deletedAt })
				.where(eq(contentStructure.id, input.structureId));
			const delta = diffContentStructureSnapshots(before, null);
			if (!delta) throw new Error("Content Structure deletion produced no delta");
			return {
				result: { deleted: true as const },
				change: {
					kind: "delta",
					delta,
					checkpoint: async () => ({
						version: 1,
						deleted: true,
						structureId: input.structureId,
					}),
				},
			};
		},
	);
}

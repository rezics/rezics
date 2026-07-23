import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	type ContentStructureKind,
} from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";
import {
	ContentStructureNodeStateSchema,
	ContentStructureSnapshotSchema,
	diffContentStructureSnapshots,
	type ContentStructureNodeState,
	type ContentStructureTarget,
} from "./contracts";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";
import {
	createContentStructureHistory,
	getContentStructureHeadRevision,
	mutateContentStructureWithHistory,
} from "./history";
import {
	assertContentStructureParent,
	contentStructureTargetColumns,
	contentStructureTargetFromRow,
	ensureContentStructureNodeAllowed,
	ensureContentStructureKindOwner,
	loadContentStructureSnapshot,
} from "./storage";

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
	"post.contents",
	"realm.taxonomy",
	"zone.pages",
]);

function ensureDirectContentStructureEditing(kind: ContentStructureKind): void {
	if (kind === "realm.navigation" || kind === "zone.navigation")
		throw new ContentStructureInvalid(
			"Navigation structures must be edited through the NavigationDocument adapter",
		);
}

export async function getContentStructureRevision(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	structureId: string,
): Promise<string | null> {
	const [owned] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.id, structureId),
				eq(contentStructure.ownerUnitId, ownerUnitId),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!owned) return null;
	return getContentStructureHeadRevision(tx, structureId);
}

export async function listContentStructures(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind?: ContentStructureKind,
) {
	return tx
		.select()
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, ownerUnitId),
				kind ? eq(contentStructure.kind, kind) : undefined,
				isNull(contentStructure.deletedAt),
			),
		)
		.orderBy(
			asc(contentStructure.kind),
			asc(contentStructure.createdAt),
			asc(contentStructure.id),
		);
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
		if (existing)
			throw new ContentStructureInvalid(`${input.kind} already exists for this Unit`);
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

async function loadStructureRecord(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	structureId: string,
) {
	const [structure] = await tx
		.select()
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.id, structureId),
				eq(contentStructure.ownerUnitId, ownerUnitId),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!structure) throw new ContentStructureNotFound();
	return structure;
}

async function touchStructure(tx: DatabaseTransaction, structureId: string) {
	const [structure] = await tx
		.update(contentStructure)
		.set({ updatedAt: new Date() })
		.where(and(eq(contentStructure.id, structureId), isNull(contentStructure.deletedAt)))
		.returning();
	if (!structure) throw new ContentStructureNotFound();
	return structure;
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
	},
) {
	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: input.structureId,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
			message: input.message,
			minor: input.minor,
		},
		async () => {
			const structure = await loadStructureRecord(tx, input.ownerUnitId, input.structureId);
			ensureDirectContentStructureEditing(structure.kind);
			const target = input.target ?? { kind: "content" };
			await ensureContentStructureNodeAllowed(tx, {
				kind: structure.kind,
				structureId: structure.id,
				ownerUnitId: structure.ownerUnitId,
				contentUnitId: input.contentUnitId,
				target,
			});
			const parentId = input.parentId ?? null;
			if (parentId !== null) {
				const [parent] = await tx
					.select({ id: contentStructureNode.id })
					.from(contentStructureNode)
					.where(
						and(
							eq(contentStructureNode.id, parentId),
							eq(contentStructureNode.structureId, structure.id),
							isNull(contentStructureNode.deletedAt),
						),
					)
					.limit(1);
				if (!parent) throw new ContentStructureInvalid("Parent node does not exist");
			}
			const [last] = input.position
				? []
				: await tx
						.select({ position: contentStructureNode.position })
						.from(contentStructureNode)
						.where(
							and(
								eq(contentStructureNode.structureId, structure.id),
								parentId === null
									? isNull(contentStructureNode.parentId)
									: eq(contentStructureNode.parentId, parentId),
								isNull(contentStructureNode.deletedAt),
							),
						)
						.orderBy(desc(contentStructureNode.position), desc(contentStructureNode.id))
						.limit(1);
			const [created] = await tx
				.insert(contentStructureNode)
				.values({
					structureId: structure.id,
					ownerUnitId: structure.ownerUnitId,
					parentId,
					contentUnitId: input.contentUnitId,
					documentKey: input.documentKey ?? null,
					...contentStructureTargetColumns(target),
					position: input.position ?? fractionalPositionBetween(last?.position, null),
					contentRating: input.contentRating ?? null,
				})
				.returning();
			if (!created) throw new Error("Content Structure node insertion returned no row");
			const updatedStructure = await touchStructure(tx, structure.id);
			const after = ContentStructureNodeStateSchema.parse(created);
			const delta = {
				version: 1,
				structureId: structure.id,
				operations: [
					{ kind: "node.insert", after },
					{
						kind: "structure.update",
						before: structure,
						after: updatedStructure,
					},
				],
			} as const;
			return {
				result: { node: created },
				change: {
					kind: "delta",
					delta,
					checkpoint: () =>
						loadContentStructureSnapshot(tx, { structureId: structure.id }),
				},
			};
		},
	);
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
	},
) {
	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: input.structureId,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
			message: input.message,
			minor: input.minor,
		},
		async () => {
			const structure = await loadStructureRecord(tx, input.ownerUnitId, input.structureId);
			ensureDirectContentStructureEditing(structure.kind);
			const [current] = await tx
				.select()
				.from(contentStructureNode)
				.where(
					and(
						eq(contentStructureNode.id, input.nodeId),
						eq(contentStructureNode.structureId, structure.id),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.limit(1);
			if (!current) throw new ContentStructureNotFound();
			if (input.parentId !== undefined) {
				await assertContentStructureParent(tx, structure.id, current.id, input.parentId);
			}
			const target = input.target ?? contentStructureTargetFromRow(current);
			const contentUnitId = input.contentUnitId ?? current.contentUnitId;
			await ensureContentStructureNodeAllowed(tx, {
				kind: structure.kind,
				structureId: structure.id,
				nodeId: current.id,
				ownerUnitId: structure.ownerUnitId,
				contentUnitId,
				target,
			});
			const [updated] = await tx
				.update(contentStructureNode)
				.set({
					parentId: input.parentId,
					contentUnitId: input.contentUnitId,
					documentKey: input.documentKey,
					...(input.target ? contentStructureTargetColumns(input.target) : {}),
					position: input.position,
					contentRating: input.contentRating,
				})
				.where(eq(contentStructureNode.id, current.id))
				.returning();
			if (!updated) throw new Error("Content Structure node update returned no row");
			const updatedStructure = await touchStructure(tx, structure.id);
			const before = ContentStructureNodeStateSchema.parse(current);
			const after = ContentStructureNodeStateSchema.parse(updated);
			const delta = {
				version: 1,
				structureId: structure.id,
				operations: [
					{ kind: "node.update", before, after },
					{
						kind: "structure.update",
						before: structure,
						after: updatedStructure,
					},
				],
			} as const;
			return {
				result: { node: updated },
				change: {
					kind: "delta",
					delta,
					checkpoint: () =>
						loadContentStructureSnapshot(tx, { structureId: structure.id }),
				},
			};
		},
	);
}

/**
 * Re-roots a tree without exposing a two-root or cyclic intermediate revision.
 *
 * This operation is intentionally restricted to `zone.pages`: its root is the
 * Zone home page, so promoting a descendant must also attach the former root
 * below the promoted node as one atomic history change.
 */
export async function rerootZonePagesContentStructure(
	tx: DatabaseTransaction,
	input: ExistingStructureMutation & {
		readonly nodeId: string;
		readonly position?: string;
	},
) {
	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: input.structureId,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
			message: input.message,
			minor: input.minor,
		},
		async () => {
			const snapshot = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
			if (snapshot.structure.kind !== "zone.pages")
				throw new ContentStructureInvalid("Only zone.pages supports re-rooting");
			const promoted = snapshot.nodes.find((node) => node.id === input.nodeId);
			if (!promoted) throw new ContentStructureNotFound();
			const formerRoot = snapshot.nodes.find((node) => node.parentId === null);
			if (!formerRoot) throw new ContentStructureInvalid("Zone pages tree has no root page");
			if (formerRoot.id === promoted.id) {
				if (input.position === undefined) return { result: { node: promoted } };
				const [updated] = await tx
					.update(contentStructureNode)
					.set({ position: input.position })
					.where(eq(contentStructureNode.id, promoted.id))
					.returning();
				if (!updated) throw new Error("Zone pages root update returned no row");
				const updatedStructure = await touchStructure(tx, snapshot.structure.id);
				return {
					result: { node: updated },
					change: {
						kind: "delta" as const,
						delta: {
							version: 1 as const,
							structureId: snapshot.structure.id,
							operations: [
								{
									kind: "node.update" as const,
									before: promoted,
									after: ContentStructureNodeStateSchema.parse(updated),
								},
								{
									kind: "structure.update" as const,
									before: snapshot.structure,
									after: updatedStructure,
								},
							],
						},
						checkpoint: () =>
							loadContentStructureSnapshot(tx, {
								structureId: snapshot.structure.id,
							}),
					},
				};
			}

			// The database invariant is deferred only inside this transaction. Both
			// rows are changed before the single valid history delta is committed.
			await tx.execute(sql`set constraints zone_pages_node_invariants deferred`);
			const [updatedPromoted] = await tx
				.update(contentStructureNode)
				.set({ parentId: null, position: input.position })
				.where(eq(contentStructureNode.id, promoted.id))
				.returning();
			const [updatedFormerRoot] = await tx
				.update(contentStructureNode)
				.set({ parentId: promoted.id })
				.where(eq(contentStructureNode.id, formerRoot.id))
				.returning();
			if (!updatedPromoted || !updatedFormerRoot)
				throw new Error("Zone pages re-root update returned no row");
			const updatedStructure = await touchStructure(tx, snapshot.structure.id);
			return {
				result: { node: updatedPromoted },
				change: {
					kind: "delta" as const,
					delta: {
						version: 1 as const,
						structureId: snapshot.structure.id,
						operations: [
							{
								kind: "node.update" as const,
								before: promoted,
								after: ContentStructureNodeStateSchema.parse(updatedPromoted),
							},
							{
								kind: "node.update" as const,
								before: formerRoot,
								after: ContentStructureNodeStateSchema.parse(updatedFormerRoot),
							},
							{
								kind: "structure.update" as const,
								before: snapshot.structure,
								after: updatedStructure,
							},
						],
					},
					checkpoint: () =>
						loadContentStructureSnapshot(tx, {
							structureId: snapshot.structure.id,
						}),
				},
			};
		},
	);
}

function descendantsOf(
	nodes: readonly ContentStructureNodeState[],
	rootId: string,
): ContentStructureNodeState[] {
	const children = new Map<string, ContentStructureNodeState[]>();
	for (const node of nodes) {
		if (node.parentId === null) continue;
		const siblings = children.get(node.parentId) ?? [];
		siblings.push(node);
		children.set(node.parentId, siblings);
	}
	const root = nodes.find((node) => node.id === rootId);
	if (!root) throw new ContentStructureNotFound();
	const result: ContentStructureNodeState[] = [];
	const visit = (node: ContentStructureNodeState) => {
		for (const child of children.get(node.id) ?? []) visit(child);
		result.push(node);
	};
	visit(root);
	return result;
}

export async function deleteContentStructureNode(
	tx: DatabaseTransaction,
	input: ExistingStructureMutation & { readonly nodeId: string },
) {
	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: input.structureId,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
			message: input.message,
			minor: input.minor,
		},
		async () => {
			const snapshot = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
			ensureDirectContentStructureEditing(snapshot.structure.kind);
			const deleted = descendantsOf(snapshot.nodes, input.nodeId);
			await tx
				.update(contentStructureNode)
				.set({ deletedAt: new Date() })
				.where(
					inArray(
						contentStructureNode.id,
						deleted.map((node) => node.id),
					),
				);
			const updatedStructure = await touchStructure(tx, snapshot.structure.id);
			const delta = {
				version: 1,
				structureId: snapshot.structure.id,
				operations: [
					...deleted.map((before) => ({ kind: "node.delete" as const, before })),
					{
						kind: "structure.update" as const,
						before: snapshot.structure,
						after: updatedStructure,
					},
				],
			};
			return {
				result: { deletedNodeIds: deleted.map((node) => node.id) },
				change: {
					kind: "delta",
					delta,
					checkpoint: () =>
						loadContentStructureSnapshot(tx, {
							structureId: snapshot.structure.id,
						}),
				},
			};
		},
	);
}

export async function deleteContentStructure(
	tx: DatabaseTransaction,
	input: ExistingStructureMutation &
		(
			| { readonly binding: "direct" }
			| {
					readonly binding: "navigation";
					readonly kind: "realm.navigation" | "zone.navigation";
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
			if (input.binding === "direct")
				ensureDirectContentStructureEditing(before.structure.kind);
			else if (before.structure.kind !== input.kind) throw new ContentStructureNotFound();
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

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	unitRevisionComponentHead,
	type ContentStructurePurpose,
} from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";
import { mutateUnitWithHistory } from "../units/history";
import {
	ContentStructureContentModel,
	ContentStructureNodeStateSchema,
	ContentStructureSnapshotSchema,
	contentStructureSlotRole,
	diffContentStructureSnapshots,
	type ContentStructureNodeState,
	type ContentStructureTarget,
} from "./contracts";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";
import {
	assertContentStructureParent,
	contentStructureTargetColumns,
	contentStructureTargetFromRow,
	ensureContentStructureNodeAllowed,
	ensureContentStructurePurposeOwner,
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

const SingletonContentStructurePurposes = new Set<ContentStructurePurpose>([
	"book.contents",
	"post.contents",
	"realm.taxonomy",
]);

function ensureDirectContentStructureEditing(purpose: ContentStructurePurpose): void {
	if (purpose === "realm.navigation" || purpose === "zone.navigation")
		throw new ContentStructureInvalid(
			"Navigation structures must be edited through the NavigationDocument adapter",
		);
}

function componentChange(role: string, delta: unknown, checkpoint: () => Promise<unknown>) {
	return { role, model: ContentStructureContentModel, delta, checkpoint } as const;
}

export async function getContentStructureComponentRevision(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	structureId: string,
): Promise<string | null> {
	const role = contentStructureSlotRole(structureId);
	const [head] = await tx
		.select({ revisionId: unitRevisionComponentHead.revisionId })
		.from(unitRevisionComponentHead)
		.where(
			and(
				eq(unitRevisionComponentHead.unitId, ownerUnitId),
				eq(unitRevisionComponentHead.componentKey, role),
			),
		)
		.limit(1);
	return head?.revisionId ?? null;
}

export async function listContentStructures(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	purpose?: ContentStructurePurpose,
) {
	return tx
		.select()
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, ownerUnitId),
				purpose ? eq(contentStructure.purpose, purpose) : undefined,
				isNull(contentStructure.deletedAt),
			),
		)
		.orderBy(
			asc(contentStructure.purpose),
			asc(contentStructure.createdAt),
			asc(contentStructure.id),
		);
}

export async function createContentStructure(
	tx: DatabaseTransaction,
	input: MutationActor & {
		readonly ownerUnitId: string;
		readonly purpose: ContentStructurePurpose;
		readonly documentKey?: string | null;
	},
) {
	return mutateUnitWithHistory(
		tx,
		{
			unitId: input.ownerUnitId,
			actorProfileId: input.actorProfileId,
			event: "update",
			message: input.message,
			minor: input.minor,
		},
		async () => {
			await ensureContentStructurePurposeOwner(tx, input.ownerUnitId, input.purpose);
			ensureDirectContentStructureEditing(input.purpose);
			if (input.documentKey != null)
				throw new ContentStructureInvalid(
					"Non-navigation structures cannot have a document key",
				);
			if (SingletonContentStructurePurposes.has(input.purpose)) {
				const [existing] = await tx
					.select({ id: contentStructure.id })
					.from(contentStructure)
					.where(
						and(
							eq(contentStructure.ownerUnitId, input.ownerUnitId),
							eq(contentStructure.purpose, input.purpose),
							isNull(contentStructure.deletedAt),
						),
					)
					.limit(1);
				if (existing)
					throw new ContentStructureInvalid(
						`${input.purpose} already exists for this Unit`,
					);
			}
			const [created] = await tx
				.insert(contentStructure)
				.values({
					ownerUnitId: input.ownerUnitId,
					purpose: input.purpose,
					documentKey: input.documentKey ?? null,
				})
				.returning();
			if (!created) throw new Error("Content Structure insertion returned no row");
			const snapshot = ContentStructureSnapshotSchema.parse({
				version: 1,
				structure: created,
				nodes: [],
			});
			const role = contentStructureSlotRole(created.id);
			return {
				result: { structure: created },
				componentChanges: [componentChange(role, snapshot, async () => snapshot)],
			};
		},
	);
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
	const role = contentStructureSlotRole(input.structureId);
	return mutateUnitWithHistory(
		tx,
		{
			unitId: input.ownerUnitId,
			actorProfileId: input.actorProfileId,
			event: "update",
			message: input.message,
			minor: input.minor,
			expectedComponents: [{ role, revisionId: input.baseRevisionId }],
		},
		async () => {
			const structure = await loadStructureRecord(tx, input.ownerUnitId, input.structureId);
			ensureDirectContentStructureEditing(structure.purpose);
			const target = input.target ?? { kind: "content" };
			await ensureContentStructureNodeAllowed(tx, {
				purpose: structure.purpose,
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
				componentChanges: [
					componentChange(role, delta, () =>
						loadContentStructureSnapshot(tx, { structureId: structure.id }),
					),
				],
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
	const role = contentStructureSlotRole(input.structureId);
	return mutateUnitWithHistory(
		tx,
		{
			unitId: input.ownerUnitId,
			actorProfileId: input.actorProfileId,
			event: "update",
			message: input.message,
			minor: input.minor,
			expectedComponents: [{ role, revisionId: input.baseRevisionId }],
		},
		async () => {
			const structure = await loadStructureRecord(tx, input.ownerUnitId, input.structureId);
			ensureDirectContentStructureEditing(structure.purpose);
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
				purpose: structure.purpose,
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
				componentChanges: [
					componentChange(role, delta, () =>
						loadContentStructureSnapshot(tx, { structureId: structure.id }),
					),
				],
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
	const role = contentStructureSlotRole(input.structureId);
	return mutateUnitWithHistory(
		tx,
		{
			unitId: input.ownerUnitId,
			actorProfileId: input.actorProfileId,
			event: "update",
			message: input.message,
			minor: input.minor,
			expectedComponents: [{ role, revisionId: input.baseRevisionId }],
		},
		async () => {
			const snapshot = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
			ensureDirectContentStructureEditing(snapshot.structure.purpose);
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
				componentChanges: [
					componentChange(role, delta, () =>
						loadContentStructureSnapshot(tx, { structureId: snapshot.structure.id }),
					),
				],
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
					readonly purpose: "realm.navigation" | "zone.navigation";
			  }
		),
) {
	const role = contentStructureSlotRole(input.structureId);
	return mutateUnitWithHistory(
		tx,
		{
			unitId: input.ownerUnitId,
			actorProfileId: input.actorProfileId,
			event: "update",
			message: input.message,
			minor: input.minor,
			expectedComponents: [{ role, revisionId: input.baseRevisionId }],
		},
		async () => {
			const before = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
			if (input.binding === "direct")
				ensureDirectContentStructureEditing(before.structure.purpose);
			else if (before.structure.purpose !== input.purpose)
				throw new ContentStructureNotFound();
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
				componentChanges: [
					componentChange(role, delta, async () => ({
						version: 1,
						deleted: true,
						structureId: input.structureId,
					})),
				],
			};
		},
	);
}

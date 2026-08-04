import { and, asc, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import {
	assertNavigationDocument,
	type NavigationDocument,
	type NavigationItem,
	type NavigationTarget,
} from "@rezics/block";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	contentStructureRevisionHead,
} from "../database/schema";
import { fractionalPositionAt } from "../ordering/position";
import {
	ContentStructureSnapshotSchema,
	type ContentStructureNodeState,
	type ContentStructureSnapshot,
	type ContentStructureTarget,
} from "./contracts";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";
import { createContentStructureHistory } from "./history";
import { deleteContentStructure } from "./service";
import { applyContentStructureBatch } from "./batch";
import type { ContentStructureBatchCommand } from "./batch-plan";
import { assertContentStructureDraftCommandLimit } from "./draft-batch";
import {
	contentStructureTargetColumns,
	ensureContentStructureNodeAllowed,
	ensureContentStructureKindOwner,
	loadContentStructureSnapshot,
} from "./storage";

export type NavigationKind = "wiki.navigation" | "zone.navigation";

function validateNavigationDocument(document: NavigationDocument): void {
	try {
		assertNavigationDocument(document, { allowExternalNavigation: true });
	} catch {
		throw new ContentStructureInvalid("Navigation document is invalid");
	}
}

async function resolveNavigationTarget(
	_tx: DatabaseTransaction,
	_ownerUnitId: string,
	_kind: NavigationKind,
	target: NavigationTarget,
): Promise<ContentStructureTarget> {
	switch (target.kind) {
		case "unit":
			return { kind: "unit", unitId: target.unitId };
		case "external":
			return { kind: "external", url: target.url };
	}
}

type DesiredNavigationNode = {
	readonly documentKey: string;
	readonly parentDocumentKey: string | null;
	readonly contentUnitId: string;
	readonly target: ContentStructureTarget;
	readonly position: string;
};

async function flattenNavigationDocument(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind: NavigationKind,
	document: NavigationDocument,
): Promise<DesiredNavigationNode[]> {
	const result: DesiredNavigationNode[] = [];
	const visit = async (
		items: readonly NavigationItem[],
		parentDocumentKey: string | null,
	): Promise<void> => {
		for (const [index, item] of items.entries()) {
			const target =
				"children" in item
					? ({ kind: "none" } as const)
					: await resolveNavigationTarget(tx, ownerUnitId, kind, item.target);
			await ensureContentStructureNodeAllowed(tx, {
				kind,
				ownerUnitId,
				contentUnitId: item.labelUnitId,
				target,
			});
			result.push({
				documentKey: item._key,
				parentDocumentKey,
				contentUnitId: item.labelUnitId,
				target,
				position: fractionalPositionAt(index),
			});
			if ("children" in item) await visit(item.children, item._key);
		}
	};
	await visit(document.items, null);
	return result;
}

async function insertNavigationNodes(
	tx: DatabaseTransaction,
	input: {
		readonly ownerUnitId: string;
		readonly structureId: string;
		readonly desired: readonly DesiredNavigationNode[];
	},
): Promise<void> {
	const nodeIdByDocumentKey = new Map<string, string>();
	for (const node of input.desired) {
		const parentId = node.parentDocumentKey
			? (nodeIdByDocumentKey.get(node.parentDocumentKey) ?? null)
			: null;
		if (node.parentDocumentKey && !parentId)
			throw new ContentStructureInvalid("Navigation parent order is invalid");
		const [created] = await tx
			.insert(contentStructureNode)
			.values({
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
				parentId,
				contentUnitId: node.contentUnitId,
				documentKey: node.documentKey,
				...contentStructureTargetColumns(node.target),
				position: node.position,
			})
			.returning({ id: contentStructureNode.id });
		if (!created) throw new Error("Navigation node insertion returned no row");
		nodeIdByDocumentKey.set(node.documentKey, created.id);
	}
}

export async function createNavigationStructure(
	tx: DatabaseTransaction,
	input: {
		readonly ownerUnitId: string;
		readonly structureId?: string;
		readonly kind: NavigationKind;
		readonly document: NavigationDocument;
		readonly actorProfileId: string;
	},
) {
	validateNavigationDocument(input.document);
	await ensureContentStructureKindOwner(tx, input.ownerUnitId, input.kind);
	const desired = await flattenNavigationDocument(
		tx,
		input.ownerUnitId,
		input.kind,
		input.document,
	);
	assertContentStructureDraftCommandLimit({
		currentNodes: [],
		deletedNodeIds: new Set(),
		changedDesiredNodeCount: desired.length,
	});
	const [structure] = await tx
		.insert(contentStructure)
		.values({
			id: input.structureId,
			ownerUnitId: input.ownerUnitId,
			kind: input.kind,
			documentKey: input.document._key,
		})
		.returning();
	if (!structure) throw new Error("Navigation Content Structure insertion returned no row");
	await insertNavigationNodes(tx, {
		ownerUnitId: input.ownerUnitId,
		structureId: structure.id,
		desired,
	});
	const checkpoint = await loadContentStructureSnapshot(tx, {
		structureId: structure.id,
	});
	const revision = await createContentStructureHistory(tx, {
		structureId: structure.id,
		actorProfileId: input.actorProfileId,
		state: checkpoint,
	});
	return { structure, ...revision };
}

export async function replaceNavigationStructure(
	tx: DatabaseTransaction,
	input: {
		readonly ownerUnitId: string;
		readonly structureId: string;
		readonly kind: NavigationKind;
		readonly document: NavigationDocument;
		readonly actorProfileId: string;
		readonly baseRevisionId: string;
	},
) {
	validateNavigationDocument(input.document);
	const result = await applyContentStructureBatch(tx, {
		ownerUnitId: input.ownerUnitId,
		structureId: input.structureId,
		baseRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		commands: async (before) => {
			if (before.structure.kind !== input.kind) throw new ContentStructureNotFound();
			const desired = await flattenNavigationDocument(
				tx,
				input.ownerUnitId,
				input.kind,
				input.document,
			);
			const currentByKey = new Map(
				before.nodes.map((node) => {
					if (!node.documentKey)
						throw new ContentStructureInvalid("Navigation node has no document key");
					return [node.documentKey, node] as const;
				}),
			);
			const newNodeCount = desired.filter(
				(node) => !currentByKey.has(node.documentKey),
			).length;
			type GeneratedIdRow = { readonly id: string };
			const generatedIds = newNodeCount
				? (
						await tx.execute<GeneratedIdRow>(
							sql`select uuidv7() as id from generate_series(1, ${newNodeCount})`,
						)
					).rows.map(({ id }) => id)
				: [];
			let generatedIdIndex = 0;
			const nodeIdByDocumentKey = new Map<string, string>();
			for (const node of desired) {
				const current = currentByKey.get(node.documentKey);
				const id = current?.id ?? generatedIds[generatedIdIndex++];
				if (!id) throw new Error("Navigation node ID generation returned too few values");
				nodeIdByDocumentKey.set(node.documentKey, id);
			}
			const commands: ContentStructureBatchCommand[] = [];
			if (before.structure.documentKey !== input.document._key)
				commands.push({
					opId: "structure",
					type: "structure.update",
					documentKey: input.document._key,
				});
			for (const node of desired) {
				const nodeId = nodeIdByDocumentKey.get(node.documentKey);
				const parentId = node.parentDocumentKey
					? nodeIdByDocumentKey.get(node.parentDocumentKey)
					: null;
				if (!nodeId || parentId === undefined)
					throw new ContentStructureInvalid("Navigation parent order is invalid");
				const current = currentByKey.get(node.documentKey);
				if (!current) {
					commands.push({
						opId: `create:${node.documentKey}`,
						type: "node.create",
						nodeId,
						parentId,
						contentUnitId: node.contentUnitId,
						documentKey: node.documentKey,
						target: node.target,
						position: node.position,
					});
					continue;
				}
				const target = contentStructureTargetColumns(node.target);
				if (
					current.contentUnitId !== node.contentUnitId ||
					current.targetKind !== target.targetKind ||
					current.targetUnitId !== target.targetUnitId ||
					current.targetUrl !== target.targetUrl
				)
					commands.push({
						opId: `update:${node.documentKey}`,
						type: "node.update",
						nodeId,
						contentUnitId: node.contentUnitId,
						target: node.target,
					});
				if (current.parentId !== parentId || current.position !== node.position)
					commands.push({
						opId: `move:${node.documentKey}`,
						type: "node.move",
						nodeId,
						parentId,
						position: node.position,
					});
				currentByKey.delete(node.documentKey);
			}
			const deletedIds = new Set([...currentByKey.values()].map(({ id }) => id));
			for (const node of currentByKey.values())
				if (node.parentId === null || !deletedIds.has(node.parentId))
					commands.push({
						opId: `delete:${node.documentKey}`,
						type: "node.deleteSubtree",
						nodeId: node.id,
					});
			return commands;
		},
		binding: "navigation",
	});
	return {
		structure: result.afterSnapshot.structure,
		revisionId: result.revisionId,
		revisionCreated: result.revisionCreated,
	};
}

export async function deleteNavigationStructure(
	tx: DatabaseTransaction,
	input: {
		readonly ownerUnitId: string;
		readonly structureId: string;
		readonly kind: NavigationKind;
		readonly actorProfileId: string;
		readonly baseRevisionId: string;
	},
) {
	return deleteContentStructure(tx, { ...input, binding: "navigation" });
}

export async function presentNavigationStructure(
	tx: DatabaseTransaction,
	input: {
		readonly ownerUnitId: string;
		readonly structureId: string;
		readonly kind: NavigationKind;
	},
): Promise<{
	readonly id: string;
	readonly ownerUnitId: string;
	readonly document: NavigationDocument;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}> {
	const snapshot = await loadContentStructureSnapshot(tx, {
		structureId: input.structureId,
		ownerUnitId: input.ownerUnitId,
	});
	return presentNavigationSnapshot(snapshot, input.kind);
}

function presentNavigationSnapshot(
	snapshot: ContentStructureSnapshot,
	kind: NavigationKind,
): {
	readonly id: string;
	readonly ownerUnitId: string;
	readonly document: NavigationDocument;
	readonly createdAt: Date;
	readonly updatedAt: Date;
} {
	if (snapshot.structure.kind !== kind) throw new ContentStructureNotFound();
	if (!snapshot.structure.documentKey)
		throw new ContentStructureInvalid("Navigation structure does not match its API");
	const children = new Map<string | null, ContentStructureNodeState[]>();
	for (const node of snapshot.nodes) {
		const siblings = children.get(node.parentId) ?? [];
		siblings.push(node);
		children.set(node.parentId, siblings);
	}
	const presentTarget = (node: ContentStructureNodeState): NavigationTarget => {
		switch (node.targetKind) {
			case "unit":
				if (!node.targetUnitId) throw new ContentStructureInvalid("Missing Unit target");
				return { kind: "unit", unitId: node.targetUnitId };
			case "external":
				if (!node.targetUrl) throw new ContentStructureInvalid("Missing URL target");
				return { kind: "external", url: node.targetUrl };
			case "content":
				return { kind: "unit", unitId: node.contentUnitId };
			case "none":
				throw new ContentStructureInvalid("Navigation group has no leaf target");
		}
	};
	const visit = (parentId: string | null, depth: number): NavigationItem[] => {
		if (depth > 3) throw new ContentStructureInvalid("Navigation exceeds depth limit");
		return (children.get(parentId) ?? []).map((node) => {
			if (!node.documentKey)
				throw new ContentStructureInvalid("Navigation node has no document key");
			const nested = children.get(node.id) ?? [];
			if (nested.length) {
				if (node.targetKind !== "none")
					throw new ContentStructureInvalid("Navigation group cannot also have a target");
				return {
					_key: node.documentKey,
					labelUnitId: node.contentUnitId,
					children: visit(node.id, depth + 1),
				};
			}
			return {
				_key: node.documentKey,
				labelUnitId: node.contentUnitId,
				target: presentTarget(node),
			};
		});
	};
	return {
		id: snapshot.structure.id,
		ownerUnitId: snapshot.structure.ownerUnitId,
		document: {
			_type: "navigation-document",
			_key: snapshot.structure.documentKey,
			items: visit(null, 1),
		},
		createdAt: snapshot.structure.createdAt,
		updatedAt: snapshot.structure.updatedAt,
	};
}

export async function listNavigationStructures(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind: NavigationKind,
) {
	const structures = await tx
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
				eq(contentStructure.kind, kind),
				isNull(contentStructure.deletedAt),
			),
		)
		.orderBy(asc(contentStructure.createdAt), asc(contentStructure.id));
	if (!structures.length) return [];
	const nodes = await tx
		.select()
		.from(contentStructureNode)
		.where(
			and(
				inArray(
					contentStructureNode.structureId,
					structures.map(({ id }) => id),
				),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.orderBy(
			asc(contentStructureNode.structureId),
			asc(contentStructureNode.position),
			asc(contentStructureNode.id),
		);
	const nodesByStructure = new Map<string, typeof nodes>();
	for (const node of nodes) {
		const structureNodes = nodesByStructure.get(node.structureId) ?? [];
		structureNodes.push(node);
		nodesByStructure.set(node.structureId, structureNodes);
	}
	return structures.map(({ latestRevisionId, ...structure }) => ({
		...presentNavigationSnapshot(
			ContentStructureSnapshotSchema.parse({
				version: 1,
				structure,
				nodes: nodesByStructure.get(structure.id) ?? [],
			}),
			kind,
		),
		latestRevisionId,
	}));
}

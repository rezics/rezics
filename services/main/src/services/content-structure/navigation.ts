import { and, eq, inArray, isNull } from "drizzle-orm";
import {
	assertNavigationDocument,
	type NavigationDocument,
	type NavigationItem,
	type NavigationTarget,
} from "@rezics/block";

import type { DatabaseTransaction } from "../database";
import { contentStructure, contentStructureNode, zonePage } from "../database/schema";
import { fractionalPositionAt } from "../ordering/position";
import {
	diffContentStructureSnapshots,
	type ContentStructureNodeState,
	type ContentStructureTarget,
} from "./contracts";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";
import { createContentStructureHistory, mutateContentStructureWithHistory } from "./history";
import { deleteContentStructure } from "./service";
import {
	contentStructureTargetColumns,
	ensureContentStructureNodeAllowed,
	ensureContentStructureKindOwner,
	loadContentStructureSnapshot,
} from "./storage";

export type NavigationKind = "realm.navigation" | "zone.navigation";

function validateNavigationDocument(document: NavigationDocument): void {
	try {
		assertNavigationDocument(document, { allowExternalNavigation: true });
	} catch {
		throw new ContentStructureInvalid("Navigation document is invalid");
	}
}

async function resolveNavigationTarget(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind: NavigationKind,
	target: NavigationTarget,
): Promise<ContentStructureTarget> {
	switch (target.kind) {
		case "unit":
			return { kind: "unit", unitId: target.unitId };
		case "external":
			return { kind: "external", url: target.url };
		case "zone-page": {
			if (kind !== "zone.navigation")
				throw new ContentStructureInvalid("Realm navigation cannot target a Zone page");
			const [page] = await tx
				.select({ id: zonePage.id })
				.from(zonePage)
				.where(and(eq(zonePage.zoneId, ownerUnitId), eq(zonePage.slug, target.slug)))
				.limit(1);
			if (!page) throw new ContentStructureInvalid("Navigation Zone page does not exist");
			return { kind: "zone_page", zonePageId: page.id };
		}
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

function nodeShapeEquals(
	current: ContentStructureNodeState,
	desired: {
		readonly parentId: string | null;
		readonly contentUnitId: string;
		readonly target: ContentStructureTarget;
		readonly position: string;
	},
): boolean {
	const columns = contentStructureTargetColumns(desired.target);
	return (
		current.parentId === desired.parentId &&
		current.contentUnitId === desired.contentUnitId &&
		current.position === desired.position &&
		current.targetKind === columns.targetKind &&
		current.targetUnitId === columns.targetUnitId &&
		current.targetZonePageId === columns.targetZonePageId &&
		current.targetUrl === columns.targetUrl
	);
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
	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: input.structureId,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
		},
		async () => {
			validateNavigationDocument(input.document);
			const before = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
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
					return [node.documentKey, node];
				}),
			);
			let changed = before.structure.documentKey !== input.document._key;
			const nodeIdByDocumentKey = new Map<string, string>();
			for (const node of desired) {
				const parentId = node.parentDocumentKey
					? (nodeIdByDocumentKey.get(node.parentDocumentKey) ?? null)
					: null;
				if (node.parentDocumentKey && !parentId)
					throw new ContentStructureInvalid("Navigation parent order is invalid");
				const current = currentByKey.get(node.documentKey);
				if (current) {
					if (!nodeShapeEquals(current, { ...node, parentId })) {
						changed = true;
						await tx
							.update(contentStructureNode)
							.set({
								parentId,
								contentUnitId: node.contentUnitId,
								...contentStructureTargetColumns(node.target),
								position: node.position,
							})
							.where(eq(contentStructureNode.id, current.id));
					}
					nodeIdByDocumentKey.set(node.documentKey, current.id);
					currentByKey.delete(node.documentKey);
					continue;
				}
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
				changed = true;
				nodeIdByDocumentKey.set(node.documentKey, created.id);
			}
			if (currentByKey.size) {
				changed = true;
				await tx
					.update(contentStructureNode)
					.set({ deletedAt: new Date() })
					.where(
						inArray(
							contentStructureNode.id,
							[...currentByKey.values()].map((node) => node.id),
						),
					);
			}
			if (changed)
				await tx
					.update(contentStructure)
					.set({ documentKey: input.document._key, updatedAt: new Date() })
					.where(eq(contentStructure.id, input.structureId));
			const after = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
			});
			const delta = diffContentStructureSnapshots(before, after);
			return {
				result: { structure: after.structure },
				change: delta
					? { kind: "delta" as const, delta, checkpoint: async () => after }
					: undefined,
			};
		},
	);
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
	if (snapshot.structure.kind !== input.kind) throw new ContentStructureNotFound();
	if (!snapshot.structure.documentKey)
		throw new ContentStructureInvalid("Navigation structure does not match its API");
	const zonePageIds = snapshot.nodes
		.map((node) => node.targetZonePageId)
		.filter((id): id is string => id !== null);
	const zonePageSlugs = zonePageIds.length
		? new Map(
				(
					await tx
						.select({ id: zonePage.id, slug: zonePage.slug })
						.from(zonePage)
						.where(inArray(zonePage.id, zonePageIds))
				).map((page) => [page.id, page.slug]),
			)
		: new Map<string, string>();
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
			case "zone_page": {
				const slug = node.targetZonePageId
					? zonePageSlugs.get(node.targetZonePageId)
					: undefined;
				if (!slug) throw new ContentStructureInvalid("Missing Zone page target");
				return { kind: "zone-page", slug };
			}
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
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, ownerUnitId),
				eq(contentStructure.kind, kind),
				isNull(contentStructure.deletedAt),
			),
		)
		.orderBy(contentStructure.createdAt, contentStructure.id);
	const records = [];
	for (const structure of structures) {
		records.push(
			await presentNavigationStructure(tx, {
				ownerUnitId,
				structureId: structure.id,
				kind,
			}),
		);
	}
	return records;
}

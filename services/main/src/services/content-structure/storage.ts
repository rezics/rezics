import { and, asc, eq, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	post,
	unit,
	zonePage,
	type ContentStructurePurpose,
	type ContentStructureTargetKind,
} from "../database/schema";
import {
	ContentStructureLogicalStateSchema,
	ContentStructurePurposePolicies,
	ContentStructureSnapshotSchema,
	type ContentStructureSnapshot,
	type ContentStructureTarget,
} from "./contracts";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";

export function contentStructureTargetFromRow(row: {
	readonly targetKind: ContentStructureTargetKind;
	readonly targetUnitId: string | null;
	readonly targetZonePageId: string | null;
	readonly targetUrl: string | null;
}): ContentStructureTarget {
	switch (row.targetKind) {
		case "content":
			return { kind: "content" };
		case "none":
			return { kind: "none" };
		case "unit":
			if (!row.targetUnitId) throw new ContentStructureInvalid("Missing Unit target");
			return { kind: "unit", unitId: row.targetUnitId };
		case "zone_page":
			if (!row.targetZonePageId)
				throw new ContentStructureInvalid("Missing Zone page target");
			return { kind: "zone_page", zonePageId: row.targetZonePageId };
		case "external":
			if (!row.targetUrl) throw new ContentStructureInvalid("Missing external target URL");
			return { kind: "external", url: row.targetUrl };
	}
}

export function contentStructureTargetColumns(target: ContentStructureTarget) {
	switch (target.kind) {
		case "content":
		case "none":
			return {
				targetKind: target.kind,
				targetUnitId: null,
				targetZonePageId: null,
				targetUrl: null,
			} as const;
		case "unit":
			return {
				targetKind: target.kind,
				targetUnitId: target.unitId,
				targetZonePageId: null,
				targetUrl: null,
			} as const;
		case "zone_page":
			return {
				targetKind: target.kind,
				targetUnitId: null,
				targetZonePageId: target.zonePageId,
				targetUrl: null,
			} as const;
		case "external":
			return {
				targetKind: target.kind,
				targetUnitId: null,
				targetZonePageId: null,
				targetUrl: target.url,
			} as const;
	}
}

export async function ensureContentStructurePurposeOwner(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	purpose: ContentStructurePurpose,
): Promise<void> {
	const [owner] = await tx
		.select({ kind: unit.kind })
		.from(unit)
		.where(and(eq(unit.id, ownerUnitId), isNull(unit.deletedAt)))
		.limit(1);
	if (
		!owner ||
		!(ContentStructurePurposePolicies[purpose].ownerKinds as readonly string[]).includes(
			owner.kind,
		)
	)
		throw new ContentStructureInvalid(`${purpose} is not valid for this Unit kind`);
}

export async function ensureContentStructureNodeAllowed(
	tx: DatabaseTransaction,
	input: {
		readonly purpose: ContentStructurePurpose;
		readonly ownerUnitId: string;
		readonly contentUnitId: string;
		readonly target: ContentStructureTarget;
	},
): Promise<void> {
	const policy = ContentStructurePurposePolicies[input.purpose];
	if (!(policy.targets as readonly string[]).includes(input.target.kind))
		throw new ContentStructureInvalid(
			`${input.target.kind} targets are not valid for ${input.purpose}`,
		);
	const [content] = await tx
		.select({ kind: unit.kind, postKind: post.kind })
		.from(unit)
		.leftJoin(post, eq(post.id, unit.id))
		.where(and(eq(unit.id, input.contentUnitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!content || !policy.acceptsContent(content.kind, content.postKind))
		throw new ContentStructureInvalid(`Content Unit is not valid for ${input.purpose}`);
	if (input.target.kind === "unit") {
		const [target] = await tx
			.select({ id: unit.id })
			.from(unit)
			.where(and(eq(unit.id, input.target.unitId), isNull(unit.deletedAt)))
			.limit(1);
		if (!target) throw new ContentStructureInvalid("Target Unit does not exist");
	}
	if (input.target.kind === "zone_page") {
		const [target] = await tx
			.select({ zoneId: zonePage.zoneId })
			.from(zonePage)
			.where(eq(zonePage.id, input.target.zonePageId))
			.limit(1);
		if (!target || target.zoneId !== input.ownerUnitId)
			throw new ContentStructureInvalid("Target Zone page is outside the owner Zone");
	}
}

export async function loadContentStructureSnapshot(
	tx: DatabaseTransaction,
	input: { readonly structureId: string; readonly ownerUnitId?: string },
): Promise<ContentStructureSnapshot> {
	const [structure] = await tx
		.select()
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.id, input.structureId),
				input.ownerUnitId ? eq(contentStructure.ownerUnitId, input.ownerUnitId) : undefined,
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!structure) throw new ContentStructureNotFound();
	const nodes = await tx
		.select()
		.from(contentStructureNode)
		.where(
			and(
				eq(contentStructureNode.structureId, structure.id),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
	return ContentStructureSnapshotSchema.parse({ version: 1, structure, nodes });
}

function orderNodesParentsFirst(snapshot: ContentStructureSnapshot) {
	const remaining = new Map(snapshot.nodes.map((node) => [node.id, node]));
	const inserted = new Set<string>();
	const ordered: ContentStructureSnapshot["nodes"] = [];
	while (remaining.size) {
		let progressed = false;
		for (const [id, node] of remaining) {
			if (node.parentId !== null && !inserted.has(node.parentId)) continue;
			ordered.push(node);
			inserted.add(id);
			remaining.delete(id);
			progressed = true;
		}
		if (!progressed) throw new ContentStructureInvalid("Content Structure contains a cycle");
	}
	return ordered;
}

export async function restoreContentStructureStates(
	tx: DatabaseTransaction,
	unitId: string,
	values: readonly unknown[],
): Promise<void> {
	const states = values.map((value) => ContentStructureLogicalStateSchema.parse(value));
	await tx
		.update(contentStructureNode)
		.set({ deletedAt: new Date() })
		.where(eq(contentStructureNode.ownerUnitId, unitId));
	await tx
		.update(contentStructure)
		.set({ deletedAt: new Date() })
		.where(eq(contentStructure.ownerUnitId, unitId));
	for (const state of states) {
		if ("deleted" in state) continue;
		if (state.structure.ownerUnitId !== unitId)
			throw new ContentStructureInvalid("History structure owner does not match Unit");
		const { id: _id, ...structureState } = state.structure;
		await tx
			.insert(contentStructure)
			.values(state.structure)
			.onConflictDoUpdate({ target: contentStructure.id, set: structureState });
		for (const node of orderNodesParentsFirst(state)) {
			const { id: _nodeId, ...nodeState } = node;
			await tx
				.insert(contentStructureNode)
				.values(node)
				.onConflictDoUpdate({ target: contentStructureNode.id, set: nodeState });
		}
	}
}

/** Release Zone-page foreign keys before History replaces the owner's page set. */
export async function detachContentStructureZonePageTargets(
	tx: DatabaseTransaction,
	ownerUnitId: string,
): Promise<void> {
	await tx
		.update(contentStructureNode)
		.set({
			targetKind: "none",
			targetZonePageId: null,
		})
		.where(
			and(
				eq(contentStructureNode.ownerUnitId, ownerUnitId),
				eq(contentStructureNode.targetKind, "zone_page"),
			),
		);
}

export async function assertContentStructureParent(
	tx: DatabaseTransaction,
	structureId: string,
	nodeId: string,
	parentId: string | null,
): Promise<void> {
	if (parentId === null) return;
	type ParentValidationRow = { readonly parentExists: boolean; readonly createsCycle: boolean };
	const result = await tx.execute<ParentValidationRow>(sql`
		with recursive ancestors (id, parent_id, visited_ids) as (
			select
				candidate.id,
				candidate.parent_id,
				array[candidate.id]
			from ${contentStructureNode} candidate
			where candidate.id = ${parentId}::uuid
				and candidate.structure_id = ${structureId}::uuid
				and candidate.deleted_at is null

			union all

			select
				parent.id,
				parent.parent_id,
				child.visited_ids || parent.id
			from ancestors child
			inner join ${contentStructureNode} parent
				on parent.id = child.parent_id
				and parent.structure_id = ${structureId}::uuid
				and parent.deleted_at is null
			where parent.id <> all(child.visited_ids)
		)
		select
			exists(select 1 from ancestors) as "parentExists",
			exists(select 1 from ancestors where id = ${nodeId}::uuid) as "createsCycle"
	`);
	const validation = result.rows[0];
	if (!validation?.parentExists) throw new ContentStructureInvalid("Parent node does not exist");
	if (validation.createsCycle)
		throw new ContentStructureInvalid("Node move would create a cycle");
}

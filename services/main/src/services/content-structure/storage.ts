import { readUnitStateById } from "../units/query";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	post,
	realmUnit,
	zonePage,
	type ContentStructureKind,
	type ContentStructureTargetKind,
} from "../database/schema";
import {
	MaximumContentStructureNodes,
	ContentStructureLogicalStateSchema,
	ContentStructureKindPolicies,
	ContentStructureSnapshotSchema,
	type ContentStructureSnapshot,
	type ContentStructureTarget,
} from "./contracts";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";

export function contentStructureTargetFromRow(row: {
	readonly targetKind: ContentStructureTargetKind;
	readonly targetUnitId: string | null;
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
				targetUrl: null,
			} as const;
		case "unit":
			return {
				targetKind: target.kind,
				targetUnitId: target.unitId,
				targetUrl: null,
			} as const;
		case "external":
			return {
				targetKind: target.kind,
				targetUnitId: null,
				targetUrl: target.url,
			} as const;
	}
}

export async function ensureContentStructureKindOwner(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind: ContentStructureKind,
): Promise<void> {
	const owner = await readUnitStateById(tx, ownerUnitId);
	if (
		!owner ||
		!(ContentStructureKindPolicies[kind].ownerKinds as readonly string[]).includes(
			owner.reference.owner,
		) ||
		(kind === "book.contents" && owner.shape !== "text_version")
	)
		throw new ContentStructureInvalid(`${kind} is not valid for this native owner and shape`);
}

export async function ensureContentStructureNodeAllowed(
	tx: DatabaseTransaction,
	input: {
		readonly kind: ContentStructureKind;
		readonly structureId?: string;
		readonly nodeId?: string;
		readonly ownerUnitId: string;
		readonly contentUnitId: string;
		readonly target: ContentStructureTarget;
	},
): Promise<void> {
	const policy = ContentStructureKindPolicies[input.kind];
	if (!(policy.targets as readonly string[]).includes(input.target.kind))
		throw new ContentStructureInvalid(
			`${input.target.kind} targets are not valid for ${input.kind}`,
		);
	const contentState = await readUnitStateById(tx, input.contentUnitId);
	const [contentPost] =
		contentState?.reference.owner === "post"
			? await tx
					.select({ kind: post.kind })
					.from(post)
					.where(eq(post.id, input.contentUnitId))
					.limit(1)
			: [];
	const content = contentState
		? {
				kind: contentState.reference.owner,
				postKind: contentPost?.kind ?? null,
				shape: contentState.shape,
			}
		: null;
	if (!content || !policy.acceptsContent(content.kind, content.postKind, content.shape))
		throw new ContentStructureInvalid(`Content Unit is not valid for ${input.kind}`);
	if (input.target.kind === "unit") {
		const target = await readUnitStateById(tx, input.target.unitId);
		if (!target) throw new ContentStructureInvalid("Target Unit does not exist");
		if (input.kind === "wiki.navigation") {
			const [targetPost] =
				target.reference.owner === "post"
					? await tx.select({ kind: post.kind }).from(post).where(eq(post.id, target.id)).limit(1)
					: [];
			if (targetPost?.kind !== "wiki")
				throw new ContentStructureInvalid("Realm Wiki navigation targets must be Wiki Posts");
		}
	}
	if (input.kind === "wiki.navigation") {
		const wikiUnitIds = [
			...(content.kind === "post" && content.postKind === "wiki" ? [input.contentUnitId] : []),
			...(input.target.kind === "unit" ? [input.target.unitId] : []),
		];
		if (wikiUnitIds.length) {
			const mounted = await tx
				.select({ unitId: realmUnit.unitId })
				.from(realmUnit)
				.where(
					and(
						eq(realmUnit.realmId, input.ownerUnitId),
						inArray(realmUnit.unitId, wikiUnitIds),
						eq(realmUnit.status, "visible"),
						eq(realmUnit.publicationState, "active"),
					),
				);
			if (new Set(mounted.map(({ unitId }) => unitId)).size !== new Set(wikiUnitIds).size)
				throw new ContentStructureInvalid(
					"Realm Wiki navigation can only contain Wiki Posts mounted in this Realm",
				);
		}
	}
	if (input.kind === "page-structure") {
		const [ownedPage] = await tx
			.select({ zoneId: zonePage.zoneId })
			.from(zonePage)
			.where(and(eq(zonePage.id, input.contentUnitId), eq(zonePage.zoneId, input.ownerUnitId)))
			.limit(1);
		if (!ownedPage) throw new ContentStructureInvalid("Zone Page Unit belongs to another Zone");
		const [membership] = await tx
			.select({ id: contentStructureNode.id, structureId: contentStructureNode.structureId })
			.from(contentStructureNode)
			.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
			.where(
				and(
					eq(contentStructure.kind, "page-structure"),
					eq(contentStructureNode.contentUnitId, input.contentUnitId),
					isNull(contentStructure.deletedAt),
					isNull(contentStructureNode.deletedAt),
				),
			)
			.limit(1);
		if (membership && membership.id !== input.nodeId)
			throw new ContentStructureInvalid(
				"Zone Page Unit is already indexed by this Zone page-structure",
			);
	}
}

/**
 * Loads the complete tree required by editors, replacement adapters, and
 * revision checkpoints.
 *
 * @remarks
 * TODO(content-structure-pagination): When consumers support lazy tree
 * hydration, add revision-bound child pagination keyed by
 * `(structureId, parentId, position, id)`. Do not expose a flat global cursor
 * as tree pagination because a page would not prove parent/child completeness.
 */
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
		.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id))
		.limit(MaximumContentStructureNodes + 1);
	if (nodes.length > MaximumContentStructureNodes)
		throw new ContentStructureInvalid(
			`Content Structure exceeds ${MaximumContentStructureNodes} nodes`,
		);
	return ContentStructureSnapshotSchema.parse({ version: 1, structure, nodes });
}

export async function restoreContentStructureState(
	tx: DatabaseTransaction,
	structureId: string,
	value: unknown,
): Promise<void> {
	const state = ContentStructureLogicalStateSchema.parse(value);
	const stateStructureId = "deleted" in state ? state.structureId : state.structure.id;
	if (stateStructureId !== structureId)
		throw new ContentStructureInvalid("History checkpoint contains another structure");
	await tx
		.update(contentStructureNode)
		.set({ deletedAt: new Date() })
		.where(eq(contentStructureNode.structureId, structureId));
	if ("deleted" in state) {
		await tx
			.update(contentStructure)
			.set({ deletedAt: new Date() })
			.where(eq(contentStructure.id, structureId));
		return;
	}
	const { id: _id, ...structureState } = state.structure;
	await tx
		.insert(contentStructure)
		.values(state.structure)
		.onConflictDoUpdate({ target: contentStructure.id, set: structureState });
	for (const node of state.nodes) {
		const { id: _nodeId, ...nodeState } = node;
		await tx
			.insert(contentStructureNode)
			.values({ ...node, parentId: null })
			.onConflictDoUpdate({
				target: contentStructureNode.id,
				set: { ...nodeState, parentId: null },
			});
	}
	for (const node of state.nodes) {
		if (node.parentId === null) continue;
		await tx
			.update(contentStructureNode)
			.set({ parentId: node.parentId })
			.where(
				and(
					eq(contentStructureNode.id, node.id),
					eq(contentStructureNode.structureId, structureId),
				),
			);
	}
}

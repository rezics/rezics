import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	tag,
	type ContentStructureKind,
	type RealmTagQueryStrategy,
} from "../database/schema";
import { RevisionedBatchCommandLimit, revisionedBatchChunks } from "../history/revisioned-batch";
import { ContentStructureNodeStateSchema } from "./contracts";
import { ContentStructureInvalid } from "./errors";
import { mutateContentStructureWithHistory } from "./history";
import {
	contentStructureTargetFromRow,
	ensureContentStructureNodeAllowed,
	loadContentStructureSnapshot,
} from "./storage";
import { planContentStructureBatch, type ContentStructureBatchCommand } from "./batch-plan";

export type ApplyContentStructureBatchInput = {
	readonly ownerUnitId: string;
	readonly structureId: string;
	readonly baseRevisionId: string;
	readonly actorProfileId: string;
	readonly commands:
		| readonly ContentStructureBatchCommand[]
		| ((
				snapshot: Awaited<ReturnType<typeof loadContentStructureSnapshot>>,
		  ) =>
				| Promise<readonly ContentStructureBatchCommand[]>
				| readonly ContentStructureBatchCommand[]);
	readonly binding?: "direct" | "navigation";
	readonly message?: string;
	readonly minor?: boolean;
};

function ensureBinding(kind: string, binding: ApplyContentStructureBatchInput["binding"]): void {
	const navigation = kind === "wiki.navigation" || kind === "zone.navigation";
	if (navigation !== (binding === "navigation"))
		throw new ContentStructureInvalid(
			navigation
				? "Navigation structures must be edited through the NavigationDocument adapter"
				: "A non-navigation structure cannot use the NavigationDocument adapter",
		);
}

async function normalizeRealmTagStrategies(
	tx: DatabaseTransaction,
	input: {
		readonly structureKind: ContentStructureKind;
		readonly snapshot: Awaited<ReturnType<typeof loadContentStructureSnapshot>>;
		readonly commands: readonly ContentStructureBatchCommand[];
	},
): Promise<readonly ContentStructureBatchCommand[]> {
	const currentByNodeId = new Map(
		input.snapshot.nodes.map(
			(node) =>
				[
					node.id,
					{
						contentUnitId: node.contentUnitId,
						realmTagQueryStrategy: node.realmTagQueryStrategy,
					},
				] as const,
		),
	);
	const candidateContentUnitIds = new Set<string>();
	for (const command of input.commands) {
		if (command.type === "node.create") candidateContentUnitIds.add(command.contentUnitId);
		else if (command.type === "node.update") {
			const contentUnitId =
				command.contentUnitId ?? currentByNodeId.get(command.nodeId)?.contentUnitId;
			if (contentUnitId) candidateContentUnitIds.add(contentUnitId);
		}
	}
	const tagUnitIds = new Set<string>();
	if (input.structureKind === "realm.taxonomy")
		for (const contentUnitIds of revisionedBatchChunks([...candidateContentUnitIds])) {
			const rows = await tx
				.select({ id: tag.id })
				.from(tag)
				.where(inArray(tag.id, contentUnitIds));
			for (const { id } of rows) tagUnitIds.add(id);
		}
	const normalize = (value: {
		readonly contentUnitId: string;
		readonly requested: RealmTagQueryStrategy | null | undefined;
		readonly current: RealmTagQueryStrategy | null;
		readonly contentChanged: boolean;
	}): RealmTagQueryStrategy | null => {
		const tagContent = tagUnitIds.has(value.contentUnitId);
		if (input.structureKind !== "realm.taxonomy") {
			if (value.requested !== undefined && value.requested !== null)
				throw new ContentStructureInvalid(
					"Realm Tag query strategies are only valid in a Realm taxonomy",
				);
			return null;
		}
		if (!tagContent) {
			if (value.requested !== undefined && value.requested !== null)
				throw new ContentStructureInvalid(
					"Realm Tag query strategies are only valid on Tag nodes",
				);
			return null;
		}
		if (value.requested === null)
			throw new ContentStructureInvalid("Realm taxonomy Tag nodes require a query strategy");
		return (
			value.requested ?? (value.contentChanged ? null : value.current) ?? "global_effective"
		);
	};
	const normalized: ContentStructureBatchCommand[] = [];
	for (const command of input.commands) {
		if (command.type === "node.create") {
			const realmTagQueryStrategy = normalize({
				contentUnitId: command.contentUnitId,
				requested: command.realmTagQueryStrategy,
				current: null,
				contentChanged: true,
			});
			currentByNodeId.set(command.nodeId, {
				contentUnitId: command.contentUnitId,
				realmTagQueryStrategy,
			});
			normalized.push({ ...command, realmTagQueryStrategy });
			continue;
		}
		if (command.type === "node.update") {
			const current = currentByNodeId.get(command.nodeId);
			if (!current) {
				normalized.push(command);
				continue;
			}
			const contentUnitId = command.contentUnitId ?? current.contentUnitId;
			const contentChanged = contentUnitId !== current.contentUnitId;
			const realmTagQueryStrategy = normalize({
				contentUnitId,
				requested: command.realmTagQueryStrategy,
				current: current.realmTagQueryStrategy,
				contentChanged,
			});
			currentByNodeId.set(command.nodeId, { contentUnitId, realmTagQueryStrategy });
			normalized.push({
				...command,
				...(contentChanged || command.realmTagQueryStrategy !== undefined
					? { realmTagQueryStrategy }
					: {}),
			});
			continue;
		}
		normalized.push(command);
	}
	return normalized;
}

async function validatePersistedBatchNodes(
	tx: DatabaseTransaction,
	input: {
		readonly structureId: string;
		readonly nodeIds: readonly string[];
	},
): Promise<void> {
	if (!input.nodeIds.length) return;
	const [structure] = await tx
		.select()
		.from(contentStructure)
		.where(and(eq(contentStructure.id, input.structureId), isNull(contentStructure.deletedAt)))
		.limit(1);
	if (!structure) throw new ContentStructureInvalid("Content Structure no longer exists");
	const nodes = await tx
		.select({ node: contentStructureNode, tagId: tag.id })
		.from(contentStructureNode)
		.leftJoin(tag, eq(tag.id, contentStructureNode.contentUnitId))
		.where(
			and(
				eq(contentStructureNode.structureId, structure.id),
				inArray(contentStructureNode.id, input.nodeIds),
				isNull(contentStructureNode.deletedAt),
			),
		);
	if (nodes.length !== new Set(input.nodeIds).size)
		throw new ContentStructureInvalid("A changed Content Structure node is unavailable");
	for (const { node, tagId } of nodes) {
		if (structure.kind === "realm.taxonomy") {
			if ((tagId !== null) !== (node.realmTagQueryStrategy !== null))
				throw new ContentStructureInvalid(
					"Only Realm taxonomy Tag nodes have a query strategy",
				);
		} else if (node.realmTagQueryStrategy !== null) {
			throw new ContentStructureInvalid(
				"Realm Tag query strategies are only valid in a Realm taxonomy",
			);
		}
		await ensureContentStructureNodeAllowed(tx, {
			kind: structure.kind,
			structureId: structure.id,
			nodeId: node.id,
			ownerUnitId: structure.ownerUnitId,
			contentUnitId: node.contentUnitId,
			target: contentStructureTargetFromRow(node),
		});
	}
	if (structure.kind === "realm.taxonomy") {
		type DuplicateTagRow = { readonly contentUnitId: string };
		const changedNodeIds = sql`array[${sql.join(
			input.nodeIds.map((nodeId) => sql`${nodeId}::uuid`),
			sql`, `,
		)}]::uuid[]`;
		const duplicate = await tx.execute<DuplicateTagRow>(sql`
			select changed.content_unit_id as "contentUnitId"
			from unnest(${changedNodeIds}) as requested(id)
			inner join ${contentStructureNode} changed on changed.id = requested.id
			inner join ${contentStructureNode} duplicate
				on duplicate.structure_id = changed.structure_id
				and duplicate.content_unit_id = changed.content_unit_id
				and duplicate.id <> changed.id
				and duplicate.deleted_at is null
			inner join ${tag} taxonomy_tag on taxonomy_tag.id = changed.content_unit_id
			where changed.structure_id = ${structure.id}::uuid
				and changed.deleted_at is null
			limit 1
		`);
		if (duplicate.rows.length)
			throw new ContentStructureInvalid("A Realm taxonomy can contain a Tag only once");
	}
}

/** Applies one fully planned, atomic Content Structure command batch. */
export async function applyContentStructureBatch(
	tx: DatabaseTransaction,
	input: ApplyContentStructureBatchInput,
) {
	if (Array.isArray(input.commands) && input.commands.length > RevisionedBatchCommandLimit)
		throw new ContentStructureInvalid(
			`Content Structure batch exceeds ${RevisionedBatchCommandLimit} commands`,
		);
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
			const before = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
			ensureBinding(before.structure.kind, input.binding ?? "direct");
			const compiledCommands =
				typeof input.commands === "function"
					? await input.commands(before)
					: input.commands;
			if (compiledCommands.length > RevisionedBatchCommandLimit)
				throw new ContentStructureInvalid(
					`Content Structure batch exceeds ${RevisionedBatchCommandLimit} commands`,
				);
			if (!compiledCommands.length)
				return {
					result: {
						results: [] as const,
						afterSnapshot: before,
						deletedNodeIds: [] as readonly string[],
					},
				};
			const commands = await normalizeRealmTagStrategies(tx, {
				structureKind: before.structure.kind,
				snapshot: before,
				commands: compiledCommands,
			});
			const now = new Date(Math.max(Date.now(), before.structure.updatedAt.getTime() + 1));
			const plan = planContentStructureBatch(before, commands, now);
			if (!plan.delta)
				return {
					result: {
						results: plan.results,
						afterSnapshot: plan.after,
						deletedNodeIds: [] as readonly string[],
					},
				};

			const inserts = plan.delta.operations.flatMap((operation) =>
				operation.kind === "node.insert" ? [operation.after] : [],
			);
			if (inserts.length) {
				const collision = await tx
					.select({ id: contentStructureNode.id })
					.from(contentStructureNode)
					.where(
						inArray(
							contentStructureNode.id,
							inserts.map(({ id }) => id),
						),
					)
					.limit(1);
				if (collision.length)
					throw new ContentStructureInvalid(
						"A new Content Structure node ID already exists",
					);
			}
			const updates = plan.delta.operations.flatMap((operation) =>
				operation.kind === "node.update" ? [operation] : [],
			);
			const deletes = plan.delta.operations.flatMap((operation) =>
				operation.kind === "node.delete" ? [operation.before] : [],
			);
			const temporarilyDetachedIds = updates
				.filter(({ before: previous, after }) => previous.parentId !== after.parentId)
				.map(({ after }) => after.id);
			const temporarilyClearedDocumentKeyIds = updates
				.filter(({ before: previous, after }) => previous.documentKey !== after.documentKey)
				.map(({ after }) => after.id);
			if (temporarilyDetachedIds.length)
				await tx
					.update(contentStructureNode)
					.set({ parentId: null })
					.where(inArray(contentStructureNode.id, temporarilyDetachedIds));
			if (temporarilyClearedDocumentKeyIds.length)
				await tx
					.update(contentStructureNode)
					.set({ documentKey: null })
					.where(inArray(contentStructureNode.id, temporarilyClearedDocumentKeyIds));
			for (const deletedIds of revisionedBatchChunks(deletes.map(({ id }) => id)))
				await tx
					.update(contentStructureNode)
					.set({ deletedAt: now })
					.where(inArray(contentStructureNode.id, deletedIds));
			for (const insertChunk of revisionedBatchChunks(inserts))
				await tx
					.insert(contentStructureNode)
					.values(insertChunk.map((node) => ({ ...node, parentId: null })));
			for (const { after } of updates)
				await tx
					.update(contentStructureNode)
					.set({
						parentId: after.parentId,
						contentUnitId: after.contentUnitId,
						documentKey: after.documentKey,
						targetKind: after.targetKind,
						targetUnitId: after.targetUnitId,
						targetUrl: after.targetUrl,
						position: after.position,
						contentRating: after.contentRating,
						realmTagQueryStrategy: after.realmTagQueryStrategy,
						updatedAt: after.updatedAt,
					})
					.where(
						and(
							eq(contentStructureNode.id, after.id),
							eq(contentStructureNode.structureId, input.structureId),
							isNull(contentStructureNode.deletedAt),
						),
					);
			for (const node of inserts)
				if (node.parentId !== null)
					await tx
						.update(contentStructureNode)
						.set({ parentId: node.parentId })
						.where(eq(contentStructureNode.id, node.id));
			await tx
				.update(contentStructure)
				.set({
					documentKey: plan.after.structure.documentKey,
					updatedAt: plan.after.structure.updatedAt,
				})
				.where(eq(contentStructure.id, input.structureId));

			const changedNodeIds = plan.delta.operations.flatMap((operation) => {
				switch (operation.kind) {
					case "node.insert":
					case "node.update":
						return [operation.after.id];
					default:
						return [];
				}
			});
			await validatePersistedBatchNodes(tx, {
				structureId: input.structureId,
				nodeIds: changedNodeIds,
			});
			const after = await loadContentStructureSnapshot(tx, {
				structureId: input.structureId,
				ownerUnitId: input.ownerUnitId,
			});
			for (const node of after.nodes) ContentStructureNodeStateSchema.parse(node);
			return {
				result: {
					results: plan.results,
					afterSnapshot: after,
					deletedNodeIds: deletes.map(({ id }) => id),
				},
				change: {
					kind: "delta" as const,
					delta: plan.delta,
					checkpoint: async () => after,
				},
			};
		},
	);
}

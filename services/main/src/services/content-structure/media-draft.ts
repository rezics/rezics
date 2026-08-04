import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	audio,
	contentStructure,
	contentStructureNode,
	label,
	unit,
	unitLocalization,
	unitOwnership,
	video,
} from "../database/schema";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { revisionedBatchChunks } from "../history/revisioned-batch";
import { isFirstUnitLocalization } from "../units/localization";
import { planContentStructureDraft, type ContentStructureDraftNodeBase } from "./book-draft-plan";
import { diffContentStructureSnapshots } from "./contracts";
import { assertContentStructureDraftCommandLimit } from "./draft-batch";
import { ContentStructureInvalid, ContentStructureRevisionConflict } from "./errors";
import {
	createContentStructureHistory,
	getContentStructureHeadRevision,
	mutateContentStructureWithHistory,
} from "./history";
import { lockContentStructureOwnerKind } from "./service";
import { ensureContentStructureKindOwner, loadContentStructureSnapshot } from "./storage";

export type ExistingMediaDraftNode = ContentStructureDraftNodeBase & {
	readonly state: "existing";
};

export type NewMediaDraftNode = ContentStructureDraftNodeBase & {
	readonly state: "new";
	readonly language: ContentLanguage;
	readonly contentKind: "video" | "audio" | "label";
};

export type AttachedMediaDraftNode = ContentStructureDraftNodeBase & {
	readonly state: "attached";
	readonly contentUnitId: string;
};

export type MediaDraftNode = ExistingMediaDraftNode | NewMediaDraftNode | AttachedMediaDraftNode;

export type MediaContentStructureDraftBase =
	{ readonly kind: "uninitialized" } | { readonly kind: "revision"; readonly revisionId: string };

export type SaveMediaContentStructureDraftInput = {
	readonly ownerUnitId: string;
	readonly base: MediaContentStructureDraftBase;
	readonly actorProfileId: string;
	readonly nodes: readonly (
		ExistingMediaDraftNode | NewMediaDraftNode | Omit<AttachedMediaDraftNode, "title">
	)[];
};

function isMediaContentUnit(row: {
	readonly unitKind: string;
	readonly labelId: string | null;
	readonly videoId: string | null;
	readonly audioId: string | null;
}): boolean {
	return (
		(row.unitKind === "label" && row.labelId !== null) ||
		(row.unitKind === "video" && row.videoId !== null) ||
		(row.unitKind === "audio" && row.audioId !== null)
	);
}

async function createMediaDraftContentUnit(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly node: NewMediaDraftNode;
	},
): Promise<string> {
	const isLabel = input.node.contentKind === "label";
	const created = await insertUnit(tx, {
		kind: input.node.contentKind,
		status: isLabel ? "published" : "draft",
		visibility: "public",
		publishedAt: isLabel ? new Date() : null,
		statusActor: { kind: "profile", profileId: input.actorProfileId },
	});
	if (input.node.contentKind === "video") await tx.insert(video).values({ id: created.id });
	else if (input.node.contentKind === "audio") await tx.insert(audio).values({ id: created.id });
	else await tx.insert(label).values({ id: created.id });
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: input.node.language,
		title: input.node.title,
	});
	await tx.insert(unitOwnership).values({
		unitId: created.id,
		profileId: input.actorProfileId,
		assignedByProfileId: input.actorProfileId,
	});
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.actorProfileId,
		event: "create",
	});
	return created.id;
}

/**
 * Persists one complete Media Content Structure draft and its newly created
 * Video, Audio, or Label Units in the caller's transaction.
 */
export async function saveMediaContentStructureDraft(
	tx: DatabaseTransaction,
	input: SaveMediaContentStructureDraftInput,
) {
	await ensureContentStructureKindOwner(tx, input.ownerUnitId, "media.contents");
	await lockContentStructureOwnerKind(tx, input.ownerUnitId, "media.contents");
	let [structure] = await tx
		.select()
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, input.ownerUnitId),
				eq(contentStructure.kind, "media.contents"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	let initializing = false;
	if (input.base.kind === "uninitialized") {
		if (structure) {
			const latestRevisionId = await getContentStructureHeadRevision(tx, structure.id);
			if (!latestRevisionId)
				throw new Error("Existing Media Content Structure has no head revision");
			throw new ContentStructureRevisionConflict(latestRevisionId);
		}
		[structure] = await tx
			.insert(contentStructure)
			.values({ ownerUnitId: input.ownerUnitId, kind: "media.contents" })
			.returning();
		if (!structure) throw new Error("Media Content Structure insertion returned no row");
		initializing = true;
	} else if (!structure) {
		throw new ContentStructureRevisionConflict(null);
	}
	const targetStructure = structure;

	const mutate = async () => {
		const before = await loadContentStructureSnapshot(tx, {
			structureId: targetStructure.id,
			ownerUnitId: input.ownerUnitId,
		});
		if (before.structure.kind !== "media.contents")
			throw new ContentStructureInvalid("Media draft targets a non-Media structure");

		const currentRows = await tx
			.select({
				id: contentStructureNode.id,
				contentUnitId: contentStructureNode.contentUnitId,
				parentId: contentStructureNode.parentId,
				position: contentStructureNode.position,
				title: unitLocalization.title,
				unitKind: unit.kind,
				labelId: label.id,
				videoId: video.id,
				audioId: audio.id,
			})
			.from(contentStructureNode)
			.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
			.leftJoin(label, eq(label.id, contentStructureNode.contentUnitId))
			.leftJoin(video, eq(video.id, contentStructureNode.contentUnitId))
			.leftJoin(audio, eq(audio.id, contentStructureNode.contentUnitId))
			.innerJoin(
				unitLocalization,
				and(
					eq(unitLocalization.unitId, contentStructureNode.contentUnitId),
					isFirstUnitLocalization(unitLocalization.unitId),
				),
			)
			.where(
				and(
					eq(contentStructureNode.structureId, targetStructure.id),
					isNull(contentStructureNode.deletedAt),
				),
			)
			.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
		if (currentRows.some((row) => row.title === null || !isMediaContentUnit(row)))
			throw new ContentStructureInvalid("Media structure contains invalid content nodes");

		const attachedContentUnitIds = [
			...new Set(
				input.nodes.flatMap((node) =>
					node.state === "attached" ? [node.contentUnitId] : [],
				),
			),
		];
		const attachedContentRows = [];
		for (const attachedIds of revisionedBatchChunks(attachedContentUnitIds))
			attachedContentRows.push(
				...(await tx
					.select({
						id: unit.id,
						title: unitLocalization.title,
						unitKind: unit.kind,
						labelId: label.id,
						videoId: video.id,
						audioId: audio.id,
					})
					.from(unit)
					.leftJoin(label, eq(label.id, unit.id))
					.leftJoin(video, eq(video.id, unit.id))
					.leftJoin(audio, eq(audio.id, unit.id))
					.innerJoin(
						unitLocalization,
						and(
							eq(unitLocalization.unitId, unit.id),
							isFirstUnitLocalization(unitLocalization.unitId),
						),
					)
					.where(and(inArray(unit.id, attachedIds), isNull(unit.deletedAt)))),
			);
		const attachedContentByUnitId = new Map(
			attachedContentRows.map((row) => [row.id, row] as const),
		);
		const draftNodes: MediaDraftNode[] = input.nodes.map((node) => {
			if (node.state !== "attached") return node;
			const content = attachedContentByUnitId.get(node.contentUnitId);
			if (!content?.title || !isMediaContentUnit(content))
				throw new ContentStructureInvalid(
					"Attached Media content Unit must be a Video, Audio, or Label",
				);
			return { ...node, title: content.title };
		});
		const current = currentRows.map((row) => ({
			id: row.id,
			parentId: row.parentId,
			position: row.position,
			title: row.title ?? "",
		}));
		const plan = planContentStructureDraft(current, draftNodes);
		if (!plan.hasChanges) return { result: {} };

		const currentById = new Map(currentRows.map((row) => [row.id, row]));
		assertContentStructureDraftCommandLimit({
			currentNodes: current,
			deletedNodeIds: plan.deletedNodeIds,
			changedDesiredNodeCount: plan.nodes.filter((node) => {
				const previous = currentById.get(node.id);
				return (
					!previous ||
					previous.parentId !== node.parentId ||
					previous.position !== node.position ||
					previous.title !== node.title
				);
			}).length,
		});
		const contentUnitIds = new Map(currentRows.map((row) => [row.id, row.contentUnitId]));
		const newNodeIds = plan.nodes
			.filter((node) => node.state !== "existing")
			.map(({ id }) => id);
		const collidingNewNodes = newNodeIds.length
			? await tx
					.select({ id: contentStructureNode.id })
					.from(contentStructureNode)
					.where(inArray(contentStructureNode.id, newNodeIds))
					.limit(1)
			: [];
		if (collidingNewNodes.length)
			throw new ContentStructureInvalid("New Media draft node ID already exists");
		const movedExistingIds = plan.nodes.flatMap((node) => {
			const previous = currentById.get(node.id);
			return previous && previous.parentId !== node.parentId ? [node.id] : [];
		});
		if (movedExistingIds.length)
			await tx
				.update(contentStructureNode)
				.set({ parentId: null })
				.where(
					and(
						eq(contentStructureNode.structureId, targetStructure.id),
						inArray(contentStructureNode.id, movedExistingIds),
						isNull(contentStructureNode.deletedAt),
					),
				);
		for (const deletedIds of revisionedBatchChunks([...plan.deletedNodeIds]))
			await tx
				.update(contentStructureNode)
				.set({ deletedAt: new Date() })
				.where(
					and(
						eq(contentStructureNode.structureId, targetStructure.id),
						inArray(contentStructureNode.id, deletedIds),
						isNull(contentStructureNode.deletedAt),
					),
				);

		for (const node of plan.nodes) {
			if (node.state === "existing") continue;
			const contentUnitId =
				node.state === "attached"
					? node.contentUnitId
					: await createMediaDraftContentUnit(tx, {
							actorProfileId: input.actorProfileId,
							node,
						});
			contentUnitIds.set(node.id, contentUnitId);
			await tx.insert(contentStructureNode).values({
				id: node.id,
				structureId: targetStructure.id,
				ownerUnitId: input.ownerUnitId,
				parentId: null,
				contentUnitId,
				position: node.position,
			});
		}

		for (const node of plan.nodes) {
			const currentNode = currentById.get(node.id);
			if (
				currentNode &&
				currentNode.parentId === node.parentId &&
				currentNode.position === node.position
			)
				continue;
			await tx
				.update(contentStructureNode)
				.set({ parentId: node.parentId, position: node.position })
				.where(
					and(
						eq(contentStructureNode.id, node.id),
						eq(contentStructureNode.structureId, targetStructure.id),
						isNull(contentStructureNode.deletedAt),
					),
				);
		}

		for (const nodeId of plan.renamedExistingNodeIds) {
			const node = plan.nodes.find((candidate) => candidate.id === nodeId);
			const contentUnitId = contentUnitIds.get(nodeId);
			if (!node || !contentUnitId)
				throw new ContentStructureInvalid("Renamed Media node is unavailable");
			const updated = await tx
				.update(unitLocalization)
				.set({ title: node.title })
				.where(
					and(
						eq(unitLocalization.unitId, contentUnitId),
						isFirstUnitLocalization(unitLocalization.unitId),
					),
				)
				.returning({ unitId: unitLocalization.unitId });
			if (!updated.length)
				throw new ContentStructureInvalid("Renamed Media localization is unavailable");
			await recordUnitRevision(tx, {
				unitId: contentUnitId,
				actorProfileId: input.actorProfileId,
				event: "update",
			});
		}

		const nextUpdatedAt = new Date(
			Math.max(Date.now(), before.structure.updatedAt.getTime() + 1),
		);
		await tx
			.update(contentStructure)
			.set({ updatedAt: nextUpdatedAt })
			.where(eq(contentStructure.id, targetStructure.id));
		const after = await loadContentStructureSnapshot(tx, {
			structureId: targetStructure.id,
			ownerUnitId: input.ownerUnitId,
		});
		const delta = diffContentStructureSnapshots(before, after);
		if (!delta)
			throw new Error("Changed Media Content Structure draft produced no revision delta");
		return {
			result: {},
			change: {
				kind: "delta" as const,
				delta,
				checkpoint: () =>
					loadContentStructureSnapshot(tx, {
						structureId: targetStructure.id,
						ownerUnitId: input.ownerUnitId,
					}),
			},
		};
	};
	if (initializing) {
		const outcome = await mutate();
		const revision = await createContentStructureHistory(tx, {
			structureId: targetStructure.id,
			actorProfileId: input.actorProfileId,
			state: await loadContentStructureSnapshot(tx, {
				structureId: targetStructure.id,
				ownerUnitId: input.ownerUnitId,
			}),
		});
		return { ...outcome.result, ...revision };
	}
	if (input.base.kind !== "revision")
		throw new TypeError("Initialized Media Content Structure requires a revision base");
	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: targetStructure.id,
			baseRevisionId: input.base.revisionId,
			actorProfileId: input.actorProfileId,
		},
		mutate,
	);
}

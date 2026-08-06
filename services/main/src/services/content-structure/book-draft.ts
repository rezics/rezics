import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	label,
	post,
	unit,
	unitOwnership,
	unitLocalization,
} from "../database/schema";
import type { UnitOwnershipMode } from "../database/schema/contract-values";
import {
	createProfileOwnedUnitAccess,
	createPublicEditableUnitAccess,
	unitOwnershipModeFromOwnerProfileId,
} from "../authorization/unit/ownership";
import { isFirstUnitLocalization } from "../units/localization";
import { insertUnit } from "../units/create";
import { ensureSubjectPostTargetingAllowed } from "../posts/targeting";
import { shouldCreateProfilePublisherAttributionForPost } from "../posts/attribution-policy";
import { applyNewPostTagMentionVotes } from "../posts/tag-mentions";
import { createProfilePublisherAttribution } from "../units/attribution";
import { recordUnitRevision } from "../units/history";
import { revisionedBatchChunks } from "../history/revisioned-batch";
import { diffContentStructureSnapshots } from "./contracts";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";
import { mutateContentStructureWithHistory } from "./history";
import { loadContentStructureSnapshot } from "./storage";
import {
	planBookContentStructureDraft,
	type AttachedBookDraftNode,
	type BookDraftNode,
	type ExistingBookDraftNode,
	type NewBookDraftNode,
	resolveChapterOwnershipMode,
} from "./book-draft-plan";
import { assertContentStructureDraftCommandLimit } from "./draft-batch";

type AttachedBookDraftNodeInput = Omit<AttachedBookDraftNode, "title">;

export type SaveBookContentStructureDraftInput = {
	readonly ownerUnitId: string;
	readonly baseRevisionId: string;
	readonly actorProfileId: string;
	readonly nodes: readonly (
		| ExistingBookDraftNode
		| NewBookDraftNode
		| AttachedBookDraftNodeInput
	)[];
};

async function createBookDraftContentUnit(
	tx: DatabaseTransaction,
	input: {
		readonly bookId: string;
		readonly bookOwnershipMode: UnitOwnershipMode | undefined;
		readonly actorProfileId: string;
		readonly node: NewBookDraftNode;
	},
): Promise<string> {
	const isChapter = input.node.contentKind === "chapter";
	let ownershipMode: UnitOwnershipMode;
	if (!isChapter) ownershipMode = "profile_owned";
	else if (input.bookOwnershipMode)
		ownershipMode = resolveChapterOwnershipMode(
			input.bookOwnershipMode,
			input.node.ownershipMode,
		);
	else if (input.node.ownershipMode) ownershipMode = input.node.ownershipMode;
	else
		throw new ContentStructureInvalid(
			"Chapter ownership has no Book default or explicit override",
		);
	const published = isChapter ? input.node.status === "published" : true;
	const created = await insertUnit(tx, {
		kind: isChapter ? "post" : "label",
		status: published ? "published" : "draft",
		visibility: "public",
		publishedAt: published ? new Date() : null,
		statusActor: { kind: "profile", profileId: input.actorProfileId },
	});
	if (isChapter) {
		await ensureSubjectPostTargetingAllowed(tx, {
			sourcePostId: created.id,
			subjectUnitId: input.bookId,
		});
		await tx.insert(post).values({
			id: created.id,
			subjectUnitId: input.bookId,
			kind: "chapter",
		});
	} else {
		await tx.insert(label).values({ id: created.id });
	}
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: input.node.language,
		title: input.node.title,
		content: isChapter ? input.node.content : undefined,
		contentStatus: isChapter ? input.node.status : undefined,
	});
	if (isChapter)
		await applyNewPostTagMentionVotes(tx, {
			postId: created.id,
			profileId: input.actorProfileId,
			nextBody: input.node.content,
		});
	if (ownershipMode === "community_owned") await createPublicEditableUnitAccess(tx, created.id);
	else await createProfileOwnedUnitAccess(tx, created.id, input.actorProfileId);
	if (isChapter && shouldCreateProfilePublisherAttributionForPost(ownershipMode))
		await createProfilePublisherAttribution(tx, {
			sourceUnitId: created.id,
			profileId: input.actorProfileId,
		});
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.actorProfileId,
		event: "create",
	});
	return created.id;
}

async function readBookOwnershipMode(
	tx: DatabaseTransaction,
	bookId: string,
): Promise<UnitOwnershipMode> {
	const [owner] = await tx
		.select({ profileId: unitOwnership.profileId })
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, bookId), isNull(unitOwnership.revokedAt)))
		.limit(1)
		.for("update");
	if (!owner) throw new ContentStructureInvalid("Book has no active ownership");
	return unitOwnershipModeFromOwnerProfileId(owner.profileId);
}

/**
 * Persists one complete Book Content Structure draft and commits at most one
 * Content Structure revision.
 *
 * @remarks
 * The base revision check, new content creation, renames, hierarchy changes,
 * ordering changes, and revision commit all execute in the caller's transaction.
 * A semantic no-op performs no writes and creates no revision.
 */
export async function saveBookContentStructureDraft(
	tx: DatabaseTransaction,
	input: SaveBookContentStructureDraftInput,
) {
	const [structure] = await tx
		.select()
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, input.ownerUnitId),
				eq(contentStructure.kind, "book.contents"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!structure) throw new ContentStructureNotFound();

	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: structure.id,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
		},
		async () => {
			const before = await loadContentStructureSnapshot(tx, {
				structureId: structure.id,
				ownerUnitId: input.ownerUnitId,
			});
			if (before.structure.kind !== "book.contents")
				throw new ContentStructureInvalid("Book draft targets a non-Book structure");
			const currentRows = await tx
				.select({
					id: contentStructureNode.id,
					contentUnitId: contentStructureNode.contentUnitId,
					parentId: contentStructureNode.parentId,
					position: contentStructureNode.position,
					title: unitLocalization.title,
					unitKind: unit.kind,
					postKind: post.kind,
					labelId: label.id,
				})
				.from(contentStructureNode)
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.leftJoin(label, eq(label.id, contentStructureNode.contentUnitId))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, contentStructureNode.contentUnitId),
						isFirstUnitLocalization(unitLocalization.unitId),
					),
				)
				.where(
					and(
						eq(contentStructureNode.structureId, structure.id),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
			if (
				currentRows.some(
					(row) =>
						row.title === null ||
						!(
							(row.unitKind === "post" && row.postKind === "chapter") ||
							(row.unitKind === "label" && row.labelId !== null)
						),
				)
			)
				throw new ContentStructureInvalid("Book structure contains invalid content nodes");
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
							postKind: post.kind,
							labelId: label.id,
						})
						.from(unit)
						.leftJoin(post, eq(post.id, unit.id))
						.leftJoin(label, eq(label.id, unit.id))
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
			const draftNodes: BookDraftNode[] = input.nodes.map((node) => {
				if (node.state !== "attached") return node;
				const content = attachedContentByUnitId.get(node.contentUnitId);
				if (
					!content?.title ||
					!(
						(content.unitKind === "post" && content.postKind === "chapter") ||
						(content.unitKind === "label" && content.labelId !== null)
					)
				)
					throw new ContentStructureInvalid(
						"Attached Book content Unit must be a Chapter or Label",
					);
				return { ...node, title: content.title };
			});
			const current = currentRows.map((row) => ({
				id: row.id,
				parentId: row.parentId,
				position: row.position,
				title: row.title ?? "",
			}));
			const plan = planBookContentStructureDraft(current, draftNodes);
			if (!plan.hasChanges) return { result: {} };
			const needsBookOwnershipMode = plan.nodes.some(
				(node) =>
					node.state === "new" &&
					node.contentKind === "chapter" &&
					node.ownershipMode === undefined,
			);
			const bookOwnershipMode = needsBookOwnershipMode
				? await readBookOwnershipMode(tx, input.ownerUnitId)
				: undefined;

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
				throw new ContentStructureInvalid("New Book draft node ID already exists");
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
							eq(contentStructureNode.structureId, structure.id),
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
							eq(contentStructureNode.structureId, structure.id),
							inArray(contentStructureNode.id, deletedIds),
							isNull(contentStructureNode.deletedAt),
						),
					);
			for (const node of plan.nodes) {
				if (node.state === "existing") continue;
				const contentUnitId =
					node.state === "attached"
						? node.contentUnitId
						: await createBookDraftContentUnit(tx, {
								bookId: input.ownerUnitId,
								bookOwnershipMode,
								actorProfileId: input.actorProfileId,
								node,
							});
				contentUnitIds.set(node.id, contentUnitId);
				await tx.insert(contentStructureNode).values({
					id: node.id,
					structureId: structure.id,
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
							eq(contentStructureNode.structureId, structure.id),
							isNull(contentStructureNode.deletedAt),
						),
					);
			}

			for (const nodeId of plan.renamedExistingNodeIds) {
				const node = plan.nodes.find((candidate) => candidate.id === nodeId);
				const contentUnitId = contentUnitIds.get(nodeId);
				if (!node || !contentUnitId)
					throw new ContentStructureInvalid("Renamed Book node is unavailable");
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
					throw new ContentStructureInvalid("Renamed Book localization is unavailable");
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
				.where(eq(contentStructure.id, structure.id));
			const after = await loadContentStructureSnapshot(tx, {
				structureId: structure.id,
				ownerUnitId: input.ownerUnitId,
			});
			const delta = diffContentStructureSnapshots(before, after);
			if (!delta)
				throw new Error("Changed Book Content Structure draft produced no revision delta");
			return {
				result: {},
				change: {
					kind: "delta" as const,
					delta,
					checkpoint: () =>
						loadContentStructureSnapshot(tx, {
							structureId: structure.id,
							ownerUnitId: input.ownerUnitId,
						}),
				},
			};
		},
	);
}

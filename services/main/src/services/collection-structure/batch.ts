import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { collection, collectionItem, post, profileFavoritesCollection } from "../database/schema";
import { UnitNotFound } from "../units/errors";
import { revisionedBatchChunks } from "../history/revisioned-batch";
import { diffCollectionStructureSnapshots } from "./contracts";
import { mutateCollectionStructureWithPlannedHistory } from "./history";
import { loadCollectionStructureSnapshot } from "./storage";
import { planCollectionBatch, type CollectionBatchCommand } from "./batch-plan";

export type CollectionBatchErrorFactory = {
	readonly invalid: (message: string) => Error;
	readonly favoritesEditForbidden: () => Error;
};

async function ensureEditableCollection(
	tx: DatabaseTransaction,
	collectionId: string,
	errors: CollectionBatchErrorFactory,
) {
	const [record] = await tx
		.select({ id: collection.id, favoritesProfileId: profileFavoritesCollection.profileId })
		.from(collection)
		.leftJoin(
			profileFavoritesCollection,
			eq(profileFavoritesCollection.collectionId, collection.id),
		)
		.where(eq(collection.id, collectionId))
		.limit(1);
	if (!record) throw new UnitNotFound();
	if (record.favoritesProfileId) throw errors.favoritesEditForbidden();
}

async function reviewSubjectsForTargets(
	tx: DatabaseTransaction,
	targetIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
	if (!targetIds.length) return new Map();
	const rows = await tx
		.select({ id: post.id, kind: post.kind, subjectUnitId: post.subjectUnitId })
		.from(post)
		.where(inArray(post.id, targetIds));
	const result = new Map<string, string>();
	for (const row of rows) {
		if (row.kind !== "review") continue;
		if (!row.subjectUnitId) throw new Error("A Review must have an authoritative subject Unit");
		result.set(row.id, row.subjectUnitId);
	}
	return result;
}

/** Applies one atomic mixed Collection membership command batch. */
export async function applyCollectionBatch(
	tx: DatabaseTransaction,
	input: {
		readonly collectionId: string;
		readonly actorProfileId: string;
		readonly baseRevisionId: string;
		readonly commands: readonly CollectionBatchCommand[];
		readonly ensureTargetReadable: (targetId: string) => Promise<void>;
		readonly errors: CollectionBatchErrorFactory;
	},
) {
	return mutateCollectionStructureWithPlannedHistory(
		tx,
		{
			collectionId: input.collectionId,
			actorProfileId: input.actorProfileId,
			baseRevisionId: input.baseRevisionId,
		},
		async () => {
			await ensureEditableCollection(tx, input.collectionId, input.errors);
			const requestedTargetIds = input.commands.flatMap((command) =>
				command.type === "item.add" ? [command.targetId] : [],
			);
			if (requestedTargetIds.includes(input.collectionId))
				throw input.errors.invalid("a Collection cannot contain itself");
			const reviewSubjectByTargetId = await reviewSubjectsForTargets(tx, requestedTargetIds);
			const readableTargetIds = new Set([
				...requestedTargetIds,
				...reviewSubjectByTargetId.values(),
			]);
			if (readableTargetIds.has(input.collectionId))
				throw input.errors.invalid("a Collection cannot contain itself as a Review subject");
			for (const targetId of readableTargetIds) await input.ensureTargetReadable(targetId);

			const before = await loadCollectionStructureSnapshot(tx, input.collectionId);
			let plan: ReturnType<typeof planCollectionBatch>;
			try {
				plan = planCollectionBatch({
					before,
					commands: input.commands,
					actorProfileId: input.actorProfileId,
					reviewSubjectByTargetId,
				});
			} catch (error) {
				if (error instanceof TypeError) throw input.errors.invalid(error.message);
				throw error;
			}
			if (!plan.delta) return { result: { results: plan.results } };
			const deletes = plan.delta.operations.flatMap((operation) =>
				operation.kind === "item.delete" ? [operation.before] : [],
			);
			const updates = plan.delta.operations.flatMap((operation) =>
				operation.kind === "item.update" ? [operation.after] : [],
			);
			const inserts = plan.delta.operations.flatMap((operation) =>
				operation.kind === "item.insert" ? [operation.after] : [],
			);
			if (deletes.length)
				await tx.delete(collectionItem).where(
					and(
						eq(collectionItem.collectionId, input.collectionId),
						inArray(
							collectionItem.unitId,
							deletes.map(({ targetUnitId }) => targetUnitId),
						),
					),
				);
			if (updates.length)
				for (const item of updates)
					await tx
						.update(collectionItem)
						.set({ position: `~batch-${item.targetUnitId}` })
						.where(
							and(
								eq(collectionItem.collectionId, input.collectionId),
								eq(collectionItem.unitId, item.targetUnitId),
							),
						);
			for (const insertChunk of revisionedBatchChunks(inserts))
				await tx.insert(collectionItem).values(
					insertChunk.map((item) => ({
						collectionId: input.collectionId,
						unitId: item.targetUnitId,
						position: item.position,
						addedByProfileId: item.addedByProfileId,
						createdAt: item.addedAt,
						updatedAt: item.addedAt,
					})),
				);
			for (const item of updates)
				await tx
					.update(collectionItem)
					.set({ position: item.position })
					.where(
						and(
							eq(collectionItem.collectionId, input.collectionId),
							eq(collectionItem.unitId, item.targetUnitId),
						),
					);
			const stored = await loadCollectionStructureSnapshot(tx, input.collectionId);
			if (diffCollectionStructureSnapshots(plan.after, stored))
				throw new Error("Stored Collection Structure differs from its batch plan");
			return {
				result: { results: plan.results },
				change: plan.delta,
			};
		},
	);
}

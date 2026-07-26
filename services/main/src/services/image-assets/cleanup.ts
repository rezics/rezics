import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { env } from "../config";
import { database } from "../database";
import { imageAsset, imageObject } from "../database/schema";
import { isStorageNotFound, storage } from "../storage";

export interface ClaimedImageAssetCleanup {
	readonly id: string;
	readonly storageKey: string;
}

export interface ImageAssetCleanupOperations {
	readonly deleteObject: (storageKey: string) => Promise<void>;
	readonly finalize: (assetId: string) => Promise<void>;
}

export function imageAssetCleanupCutoff(
	now: Date,
	uploadExpiresInSeconds: number,
	graceMilliseconds: number,
): Date {
	const nowMilliseconds = now.getTime();
	if (Number.isNaN(nowMilliseconds)) throw new TypeError("Cleanup time must be valid");
	if (!Number.isSafeInteger(uploadExpiresInSeconds) || uploadExpiresInSeconds < 1)
		throw new RangeError("Upload expiry must be a positive integer");
	if (!Number.isSafeInteger(graceMilliseconds) || graceMilliseconds < 0)
		throw new RangeError("Cleanup grace must be a non-negative integer");
	return new Date(nowMilliseconds - uploadExpiresInSeconds * 1_000 - graceMilliseconds);
}

async function claimImageAssetCleanupBatch(input: {
	readonly batchSize: number;
	readonly cutoff: Date;
	readonly now: Date;
	readonly retryCutoff: Date;
}): Promise<ClaimedImageAssetCleanup[]> {
	return database.transaction(async (tx) => {
		const candidates = await tx
			.select({
				id: imageAsset.id,
				storageKey: imageObject.storageKey,
			})
			.from(imageAsset)
			.innerJoin(imageObject, eq(imageObject.assetId, imageAsset.id))
			.where(
				and(
					isNull(imageAsset.deletedAt),
					or(
						and(
							eq(imageAsset.status, "failed"),
							lte(imageAsset.updatedAt, input.retryCutoff),
						),
						and(
							eq(imageAsset.status, "pending"),
							lte(imageAsset.createdAt, input.cutoff),
						),
					),
				),
			)
			.orderBy(asc(imageAsset.updatedAt), asc(imageAsset.createdAt), asc(imageAsset.id))
			.limit(input.batchSize)
			.for("update", { skipLocked: true });
		const candidateIds = candidates.map(({ id }) => id);
		if (candidateIds.length > 0)
			// updatedAt is the bounded cleanup lease: retries wait one interval,
			// and a crashed worker's claims become eligible again automatically.
			await tx
				.update(imageAsset)
				.set({ status: "failed", updatedAt: input.now })
				.where(and(inArray(imageAsset.id, candidateIds), isNull(imageAsset.deletedAt)));
		return candidates.map(({ id, storageKey }) => ({ id, storageKey }));
	});
}

async function deleteImageAssetObject(storageKey: string): Promise<void> {
	await storage.delete({ Key: storageKey }).catch((error: unknown) => {
		if (!isStorageNotFound(error)) throw error;
	});
}

async function finalizeImageAssetCleanup(assetId: string, now: Date): Promise<void> {
	await database
		.update(imageAsset)
		.set({ deletedAt: now, updatedAt: now })
		.where(
			and(
				eq(imageAsset.id, assetId),
				eq(imageAsset.status, "failed"),
				isNull(imageAsset.deletedAt),
			),
		);
}

/**
 * Delete every claimed object independently, then report all failures so one
 * transient storage error cannot prevent the rest of the batch from progressing.
 */
export async function cleanupClaimedImageAssets(
	claimed: readonly ClaimedImageAssetCleanup[],
	operations: ImageAssetCleanupOperations,
): Promise<number> {
	const failures: unknown[] = [];
	let cleaned = 0;
	for (const item of claimed) {
		try {
			await operations.deleteObject(item.storageKey);
			await operations.finalize(item.id);
			cleaned += 1;
		} catch (error) {
			failures.push(error);
		}
	}
	if (failures.length > 0)
		throw new AggregateError(failures, "One or more image asset cleanup operations failed");
	return cleaned;
}

export async function cleanupExpiredPendingImageAssets(now = new Date()): Promise<number> {
	const cutoff = imageAssetCleanupCutoff(
		now,
		env.S3_PRESIGN_EXPIRES_IN,
		env.IMAGE_ASSET_CLEANUP_GRACE_MS,
	);
	const claimed = await claimImageAssetCleanupBatch({
		batchSize: env.IMAGE_ASSET_CLEANUP_BATCH_SIZE,
		cutoff,
		now,
		retryCutoff: new Date(now.getTime() - env.IMAGE_ASSET_CLEANUP_INTERVAL_MS),
	});
	return cleanupClaimedImageAssets(claimed, {
		deleteObject: deleteImageAssetObject,
		finalize: (assetId) => finalizeImageAssetCleanup(assetId, now),
	});
}

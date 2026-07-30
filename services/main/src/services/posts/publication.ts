import type { DatabaseTransaction } from "../database";
import { realmUnit } from "../database/schema";
import { ensurePostMountTargetingAllowed } from "./targeting";

/** Returns a stable, duplicate-free Realm publication set. */
export function normalizePublishRealmIds(realmIds: readonly string[]): readonly string[] {
	return [...new Set(realmIds)].sort();
}

/**
 * Validates and stores every Realm publication for a newly-created Post in the caller's
 * transaction.
 *
 * @internal
 */
export async function publishPostToRealms(
	tx: DatabaseTransaction,
	input: {
		readonly postId: string;
		readonly realmIds: readonly string[];
	},
): Promise<void> {
	const realmIds = normalizePublishRealmIds(input.realmIds);
	if (!realmIds.length) return;
	await ensurePostMountTargetingAllowed(tx, {
		postId: input.postId,
		realmIds,
	});
	await tx.insert(realmUnit).values(
		realmIds.map((realmId) => ({
			realmId,
			unitId: input.postId,
		})),
	);
}

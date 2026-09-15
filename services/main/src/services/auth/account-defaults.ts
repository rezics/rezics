import type { DatabaseTransaction } from "../database";
import { accountFavoritesState } from "../database/schema/favorites";
import { ensureOfficialZoneFollows } from "../bootstrap/official-zone-follows";

/** Required account resources are committed with first self-identity admission. @internal */
export async function initializeAccountParticipation(
	tx: DatabaseTransaction,
	selfEntityId: string,
	authUserId: string,
) {
	await tx.insert(accountFavoritesState).values({ authUserId }).onConflictDoNothing();
	await ensureOfficialZoneFollows(tx, [selfEntityId], { sequenceIsEmpty: true });
}

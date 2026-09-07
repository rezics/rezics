import { OfficialRealmUnitIds } from "@rezics/slug";
import type { DatabaseTransaction } from "../database";
import { realmMember } from "../database/schema/realm";
import { ensureFavoritesInTransaction } from "../collections/favorites";
import { ensureOfficialZoneFollows } from "../bootstrap/official-zone-follows";

/** Required account resources are committed with first self-identity admission. @internal */
export async function initializeAccountParticipation(
	tx: DatabaseTransaction,
	selfEntityId: string,
) {
	await tx
		.insert(realmMember)
		.values({ realmId: OfficialRealmUnitIds.score, profileId: selfEntityId, state: "active" })
		.onConflictDoNothing();
	await ensureFavoritesInTransaction(tx, selfEntityId);
	await ensureOfficialZoneFollows(tx, [selfEntityId], { sequenceIsEmpty: true });
}

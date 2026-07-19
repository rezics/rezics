import type { DatabaseTransaction } from "../../database";
import { unitAccessBinding } from "../../database/schema";

/**
 * Community catalog entries are stewarded by Rezics, while their submitter receives
 * editing access without acquiring governance ownership.
 */
export async function createSystemOwnedCatalogAccess(
	tx: DatabaseTransaction,
	unitId: string,
	contributorProfileId: string,
	contributorRole: "editor" | "publisher" = "editor",
): Promise<void> {
	await tx.insert(unitAccessBinding).values([
		{
			unitId,
			subjectKind: "system",
			role: "owner",
			scope: [],
			grantedByProfileId: contributorProfileId,
		},
		{
			unitId,
			subjectKind: "profile",
			profileId: contributorProfileId,
			role: contributorRole,
			scope: [],
			grantedByProfileId: contributorProfileId,
		},
	]);
}

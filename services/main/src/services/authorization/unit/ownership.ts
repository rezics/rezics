import type { DatabaseTransaction } from "../../database";
import { unitAccessBinding } from "../../database/schema";
import { OfficialProfileIds } from "../../bootstrap/manifest";

export async function createProfileOwnedUnitAccess(
	tx: DatabaseTransaction,
	unitId: string,
	ownerProfileId: string,
): Promise<void> {
	await tx.insert(unitAccessBinding).values({
		unitId,
		subjectKind: "profile",
		profileId: ownerProfileId,
		role: "owner",
		scope: [],
		grantedByProfileId: ownerProfileId,
	});
}

/**
 * Community catalog entries are stewarded by the ordinary Rezics Community Profile,
 * while their submitter receives editing access without acquiring governance ownership.
 */
export async function createCommunityCatalogAccess(
	tx: DatabaseTransaction,
	unitId: string,
	contributorProfileId: string,
	contributorRole: "editor" | "publishing_editor" = "editor",
): Promise<void> {
	await tx.insert(unitAccessBinding).values([
		{
			unitId,
			subjectKind: "profile",
			profileId: OfficialProfileIds.community,
			role: "owner",
			scope: [],
			grantedByProfileId: OfficialProfileIds.community,
		},
		{
			unitId,
			subjectKind: "profile",
			profileId: contributorProfileId,
			role: contributorRole,
			scope: [],
			grantedByProfileId: OfficialProfileIds.community,
		},
	]);
}

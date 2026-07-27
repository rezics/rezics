import type { DatabaseTransaction } from "../../database";
import { unitAccessGrant, unitOwnership } from "../../database/schema";
import { OfficialProfileIds } from "../../bootstrap/manifest";
import { expandUnitPermissions, type UnitPermission } from "./policy";

export async function createProfileOwnedUnitAccess(
	tx: DatabaseTransaction,
	unitId: string,
	ownerProfileId: string,
): Promise<void> {
	await tx.insert(unitOwnership).values({
		unitId,
		profileId: ownerProfileId,
		assignedByProfileId: ownerProfileId,
	});
}

async function grantProfilePermissions(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly profileId: string;
		readonly permissions: readonly UnitPermission[];
		readonly grantedByProfileId: string;
	},
) {
	const permissions = expandUnitPermissions(input.permissions);
	if (!permissions.length) return;
	await tx.insert(unitAccessGrant).values(
		permissions.map((permission) => ({
			unitId: input.unitId,
			subjectKind: "profile" as const,
			profileId: input.profileId,
			permission,
			scope: [],
			grantedByProfileId: input.grantedByProfileId,
		})),
	);
}

/**
 * Community catalog entries are stewarded by the ordinary Rezics Community Profile,
 * while their submitter receives explicit editing permissions without ownership.
 */
export async function createCommunityCatalogAccess(
	tx: DatabaseTransaction,
	unitId: string,
	contributorProfileId: string,
	contributorPermissions: readonly UnitPermission[] = ["unit.update"],
): Promise<void> {
	await tx.insert(unitOwnership).values({
		unitId,
		profileId: OfficialProfileIds.community,
		assignedByProfileId: OfficialProfileIds.community,
	});
	await grantProfilePermissions(tx, {
		unitId,
		profileId: contributorProfileId,
		permissions: contributorPermissions,
		grantedByProfileId: OfficialProfileIds.community,
	});
}

/**
 * Gives an immutable community-owned Unit a single governance owner.
 *
 * Structure submitters are attributed in the structure definition and vote as
 * ordinary community members; editing access would contradict immutability.
 */
export async function createCommunityOwnedUnitAccess(
	tx: DatabaseTransaction,
	unitId: string,
): Promise<void> {
	await tx.insert(unitOwnership).values({
		unitId,
		profileId: OfficialProfileIds.community,
		assignedByProfileId: OfficialProfileIds.community,
	});
}

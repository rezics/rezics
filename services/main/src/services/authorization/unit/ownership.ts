import type { DelegableUnitPermission } from "@rezics/access";
import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { unitAccessGrant, unitAccessRestriction, unitOwnership } from "../../database/schema";
import { OfficialProfileIds } from "../../bootstrap/manifest";
import { expandDelegableUnitPermissions } from "./policy";

export type UnitOwnershipMode = "profile_owned" | "community_owned";

export function unitOwnershipModeFromOwnerProfileId(
	ownerProfileId: string | null,
): UnitOwnershipMode {
	return ownerProfileId === OfficialProfileIds.community ? "community_owned" : "profile_owned";
}

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

export type ReplaceUnitOwnershipResult =
	| {
			readonly ok: true;
			readonly ownershipId: string;
			readonly previousOwnerProfileId: string | null;
	  }
	| {
			readonly ok: false;
			readonly reason: "owner_changed" | "owner_unchanged";
	  };

/**
 * Replaces the active owner while preserving append-only ownership history.
 *
 * The caller must hold the Unit access advisory lock for the transaction. The
 * expected owner may be null so platform governance can recover ownerless Units.
 * Direct Profile grants and restrictions are removed because ownership becomes
 * the target Profile's complete authority source.
 */
export async function replaceUnitOwnership(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly expectedOwnerProfileId: string | null;
		readonly targetProfileId: string;
		readonly actorProfileId: string;
		readonly now: Date;
	},
): Promise<ReplaceUnitOwnershipResult> {
	const [currentOwner] = await tx
		.select({ id: unitOwnership.id, profileId: unitOwnership.profileId })
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, input.unitId), isNull(unitOwnership.revokedAt)))
		.limit(1)
		.for("update");
	const currentOwnerProfileId = currentOwner?.profileId ?? null;
	if (currentOwnerProfileId !== input.expectedOwnerProfileId)
		return { ok: false, reason: "owner_changed" };
	if (currentOwnerProfileId === input.targetProfileId)
		return { ok: false, reason: "owner_unchanged" };

	if (currentOwner) {
		const revoked = await tx
			.update(unitOwnership)
			.set({
				revokedAt: input.now,
				revokedByProfileId: input.actorProfileId,
				updatedAt: input.now,
			})
			.where(and(eq(unitOwnership.id, currentOwner.id), isNull(unitOwnership.revokedAt)))
			.returning({ id: unitOwnership.id });
		if (!revoked.length) return { ok: false, reason: "owner_changed" };
	}

	await tx
		.update(unitAccessGrant)
		.set({
			revokedAt: input.now,
			revokedByProfileId: input.actorProfileId,
			updatedAt: input.now,
		})
		.where(
			and(
				eq(unitAccessGrant.unitId, input.unitId),
				eq(unitAccessGrant.subjectKind, "profile"),
				eq(unitAccessGrant.profileId, input.targetProfileId),
				isNull(unitAccessGrant.revokedAt),
			),
		);
	await tx
		.update(unitAccessRestriction)
		.set({
			revokedAt: input.now,
			revokedByProfileId: input.actorProfileId,
			updatedAt: input.now,
		})
		.where(
			and(
				eq(unitAccessRestriction.unitId, input.unitId),
				eq(unitAccessRestriction.subjectKind, "profile"),
				eq(unitAccessRestriction.profileId, input.targetProfileId),
				isNull(unitAccessRestriction.revokedAt),
			),
		);
	const [ownership] = await tx
		.insert(unitOwnership)
		.values({
			unitId: input.unitId,
			profileId: input.targetProfileId,
			assignedByProfileId: input.actorProfileId,
		})
		.returning({ id: unitOwnership.id });
	if (!ownership) throw new Error("Unit ownership insertion returned no row");
	return {
		ok: true,
		ownershipId: ownership.id,
		previousOwnerProfileId: currentOwnerProfileId,
	};
}

async function grantProfilePermissions(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly profileId: string;
		readonly permissions: readonly DelegableUnitPermission[];
		readonly grantedByProfileId: string;
	},
) {
	const permissions = expandDelegableUnitPermissions(input.permissions);
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
 * Creates a community-governed Unit that every authenticated Profile may edit.
 *
 * The creator intentionally receives no ownership or direct grant. Their access
 * is exactly the same authenticated grant available to every other Profile.
 */
export async function createPublicEditableUnitAccess(
	tx: DatabaseTransaction,
	unitId: string,
	authenticatedPermissions: readonly DelegableUnitPermission[] = ["unit.update"],
): Promise<void> {
	await tx.insert(unitOwnership).values({
		unitId,
		profileId: OfficialProfileIds.community,
		assignedByProfileId: OfficialProfileIds.community,
	});
	await tx
		.insert(unitAccessGrant)
		.values(
			expandDelegableUnitPermissions(authenticatedPermissions).map((permission) => ({
				unitId,
				subjectKind: "authenticated" as const,
				permission,
				scope: [],
				grantedByProfileId: OfficialProfileIds.community,
			})),
		)
		.onConflictDoNothing();
}

/**
 * Community-owned Units are stewarded by the ordinary Rezics Community Profile,
 * while their submitter receives explicit editing permissions without ownership.
 */
export async function createCommunityContributedUnitAccess(
	tx: DatabaseTransaction,
	unitId: string,
	contributorProfileId: string,
	contributorPermissions: readonly DelegableUnitPermission[] = ["unit.update"],
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

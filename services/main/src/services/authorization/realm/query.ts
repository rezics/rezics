import { and, eq, exists, isNull, or, sql, type SQLWrapper } from "drizzle-orm";

import { database } from "../../database";
import { platformCapabilityGrant, realmMember, unit } from "../../database/schema";
import { getUnitRootPermissionCondition } from "../unit/query";

type RealmParticipationTarget = {
	readonly id: SQLWrapper;
	readonly deletedAt: SQLWrapper;
};

/**
 * Return the SQL predicate equivalent of `RealmAuthorization.ensureParticipation`.
 *
 * The target query must separately prove that each row is a Realm Unit.
 */
export function getRealmParticipationCondition(
	profileId: string,
	target: RealmParticipationTarget = unit,
) {
	const activeMembership = exists(
		database
			.select({ profileId: realmMember.profileId })
			.from(realmMember)
			.where(
				and(
					eq(realmMember.realmId, target.id),
					eq(realmMember.profileId, profileId),
					eq(realmMember.state, "active"),
				),
			),
	);
	return and(activeMembership, getRealmContributionCondition(profileId, target));
}

/**
 * Return the capability half of a Realm participation decision.
 *
 * Callers must separately prove active Realm membership.
 */
export function getRealmContributionCondition(
	profileId: string,
	target: RealmParticipationTarget = unit,
) {
	const platformParticipation = exists(
		database
			.select({ id: platformCapabilityGrant.id })
			.from(platformCapabilityGrant)
			.where(
				and(
					eq(platformCapabilityGrant.profileId, profileId),
					eq(platformCapabilityGrant.capability, "realm.contribute"),
					isNull(platformCapabilityGrant.revokedAt),
					or(
						isNull(platformCapabilityGrant.expiresAt),
						sql`${platformCapabilityGrant.expiresAt} > now()`,
					),
				),
			),
	);
	return and(
		isNull(target.deletedAt),
		or(
			getUnitRootPermissionCondition(profileId, "realm.contribute", target),
			platformParticipation,
		),
	);
}

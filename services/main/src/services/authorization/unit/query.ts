import { and, eq, exists, inArray, isNull, not, or, sql, type SQLWrapper } from "drizzle-orm";

import { database } from "../../database";
import {
	platformCapabilityGrant,
	realmMember,
	unit,
	unitAccessGrant,
	unitAccessRestriction,
	unitOwnership,
} from "../../database/schema";

type UnitReadTarget = {
	readonly id: SQLWrapper;
	readonly status: SQLWrapper;
	readonly visibility: SQLWrapper;
	readonly moderationStatus: SQLWrapper;
	readonly deletedAt: SQLWrapper;
};

function activeGrant() {
	return and(
		isNull(unitAccessGrant.revokedAt),
		or(isNull(unitAccessGrant.expiresAt), sql`${unitAccessGrant.expiresAt} > now()`),
	);
}

export function getUnitReadCondition(
	profileId?: string,
	options: { readonly discoverableOnly?: boolean } = {},
	target: UnitReadTarget = unit,
) {
	const visible = and(
		eq(target.status, "published"),
		options.discoverableOnly
			? eq(target.visibility, "public")
			: inArray(target.visibility, ["public", "unlisted"]),
		eq(target.moderationStatus, "approved"),
		isNull(target.deletedAt),
	);
	if (!profileId) return visible;

	const ownership = exists(
		database
			.select({ id: unitOwnership.id })
			.from(unitOwnership)
			.where(
				and(
					eq(unitOwnership.unitId, target.id),
					eq(unitOwnership.profileId, profileId),
					isNull(unitOwnership.revokedAt),
				),
			),
	);
	const profileRestriction = exists(
		database
			.select({ id: unitAccessRestriction.id })
			.from(unitAccessRestriction)
			.where(
				and(
					eq(unitAccessRestriction.unitId, target.id),
					eq(unitAccessRestriction.permission, "unit.read"),
					sql`cardinality(${unitAccessRestriction.scope}) = 0`,
					eq(unitAccessRestriction.subjectKind, "profile"),
					eq(unitAccessRestriction.profileId, profileId),
					isNull(unitAccessRestriction.revokedAt),
					or(
						isNull(unitAccessRestriction.expiresAt),
						sql`${unitAccessRestriction.expiresAt} > now()`,
					),
				),
			),
	);
	const realmRestriction = exists(
		database
			.select({ id: unitAccessRestriction.id })
			.from(unitAccessRestriction)
			.where(
				and(
					eq(unitAccessRestriction.unitId, target.id),
					eq(unitAccessRestriction.permission, "unit.read"),
					sql`cardinality(${unitAccessRestriction.scope}) = 0`,
					eq(unitAccessRestriction.subjectKind, "realm"),
					isNull(unitAccessRestriction.revokedAt),
					or(
						isNull(unitAccessRestriction.expiresAt),
						sql`${unitAccessRestriction.expiresAt} > now()`,
					),
					exists(
						database
							.select({ id: realmMember.profileId })
							.from(realmMember)
							.where(
								and(
									eq(realmMember.realmId, unitAccessRestriction.realmId),
									eq(realmMember.profileId, profileId),
									eq(realmMember.state, "active"),
								),
							),
					),
				),
			),
	);
	const platformSubject = exists(
		database
			.select({ id: platformCapabilityGrant.id })
			.from(platformCapabilityGrant)
			.where(
				and(
					eq(platformCapabilityGrant.profileId, profileId),
					eq(platformCapabilityGrant.capability, "unit.edit"),
					isNull(platformCapabilityGrant.revokedAt),
					or(
						isNull(platformCapabilityGrant.expiresAt),
						sql`${platformCapabilityGrant.expiresAt} > now()`,
					),
				),
			),
	);
	const matchingGrant = exists(
		database
			.select({ id: unitAccessGrant.id })
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, target.id),
					eq(unitAccessGrant.permission, "unit.read"),
					sql`cardinality(${unitAccessGrant.scope}) = 0`,
					activeGrant(),
					or(
						eq(unitAccessGrant.subjectKind, "authenticated"),
						and(
							eq(unitAccessGrant.subjectKind, "profile"),
							eq(unitAccessGrant.profileId, profileId),
						),
						and(
							eq(unitAccessGrant.subjectKind, "realm"),
							exists(
								database
									.select({ id: realmMember.profileId })
									.from(realmMember)
									.where(
										and(
											eq(realmMember.realmId, unitAccessGrant.realmId),
											eq(realmMember.profileId, profileId),
											eq(realmMember.state, "active"),
										),
									),
							),
						),
					),
				),
			),
	);
	return and(
		isNull(target.deletedAt),
		or(
			platformSubject,
			and(
				not(profileRestriction),
				or(ownership, and(not(realmRestriction), or(visible, matchingGrant))),
			),
		),
	);
}

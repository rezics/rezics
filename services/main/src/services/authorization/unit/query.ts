import type { DelegableUnitPermission } from "@rezics/access";
import {
	and,
	eq,
	exists,
	inArray,
	isNull,
	not,
	or,
	sql,
	type SQL,
	type SQLWrapper,
} from "drizzle-orm";

import { database } from "../../database";
import {
	realmMember,
	unit,
	unitAccessGrant,
	unitAccessRestriction,
	unitOwnership,
} from "../../database/schema";
import { getPlatformCapabilityCondition } from "../platform/query";
import type { UnitScope } from "./scope";

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

function activeRestriction() {
	return and(
		isNull(unitAccessRestriction.revokedAt),
		or(
			isNull(unitAccessRestriction.expiresAt),
			sql`${unitAccessRestriction.expiresAt} > now()`,
		),
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
	if (!profileId || options.discoverableOnly) return visible;

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
	const platformSubject = getPlatformCapabilityCondition(profileId, "unit.edit");
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

function scopePrefixCondition(
	column: typeof unitAccessGrant.scope | typeof unitAccessRestriction.scope,
	scope: UnitScope,
): SQL {
	const prefixes = Array.from({ length: scope.length + 1 }, (_, length) =>
		eq(column, scope.slice(0, length)),
	);
	return or(...prefixes) ?? sql`false`;
}

/** Return the SQL predicate equivalent of a scoped delegable Unit permission decision. */
export function getUnitPermissionCondition(
	profileId: string,
	permission: DelegableUnitPermission,
	scope: UnitScope,
	target: Pick<UnitReadTarget, "id" | "deletedAt"> = unit,
) {
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
	const platformSubject = getPlatformCapabilityCondition(profileId, "unit.edit");
	const profileRestriction = exists(
		database
			.select({ id: unitAccessRestriction.id })
			.from(unitAccessRestriction)
			.where(
				and(
					eq(unitAccessRestriction.unitId, target.id),
					eq(unitAccessRestriction.permission, permission),
					scopePrefixCondition(unitAccessRestriction.scope, scope),
					eq(unitAccessRestriction.subjectKind, "profile"),
					eq(unitAccessRestriction.profileId, profileId),
					activeRestriction(),
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
					eq(unitAccessRestriction.permission, permission),
					scopePrefixCondition(unitAccessRestriction.scope, scope),
					eq(unitAccessRestriction.subjectKind, "realm"),
					activeRestriction(),
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
	const matchingGrant = exists(
		database
			.select({ id: unitAccessGrant.id })
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, target.id),
					eq(unitAccessGrant.permission, permission),
					scopePrefixCondition(unitAccessGrant.scope, scope),
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
			ownership,
			and(not(profileRestriction), not(realmRestriction), matchingGrant),
		),
	);
}

/** Return the SQL predicate equivalent of a root-scoped delegable Unit permission decision. */
export function getUnitRootPermissionCondition(
	profileId: string,
	permission: DelegableUnitPermission,
	target: Pick<UnitReadTarget, "id" | "deletedAt"> = unit,
) {
	return getUnitPermissionCondition(profileId, permission, [], target);
}

/** Return the SQL predicate equivalent of a root-scoped `unit.update` decision. */
export function getUnitUpdateCondition(
	profileId: string,
	target: Pick<UnitReadTarget, "id" | "deletedAt"> = unit,
) {
	return getUnitRootPermissionCondition(profileId, "unit.update", target);
}

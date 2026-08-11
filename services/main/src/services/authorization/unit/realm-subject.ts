import { and, eq, exists, isNull, not, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import type { DatabaseExecutor } from "../../database";
import {
	realmMember,
	unit,
	unitAccessGrant,
	unitAccessRestriction,
	unitOwnership,
} from "../../database/schema";

const managerUnit = alias(unit, "realm_access_manager_unit");
const managerOwnership = alias(unitOwnership, "realm_access_manager_ownership");
const managerGrant = alias(unitAccessGrant, "realm_access_manager_grant");
const managerGrantMember = alias(realmMember, "realm_access_manager_grant_member");
const managerRestriction = alias(unitAccessRestriction, "realm_access_manager_restriction");
const managerRestrictionMember = alias(realmMember, "realm_access_manager_restriction_member");

function activeRealmMembership(
	executor: DatabaseExecutor,
	realmId: AnyPgColumn,
	profileId: string,
) {
	return exists(
		executor
			.select({ profileId: realmMember.profileId })
			.from(realmMember)
			.where(
				and(
					eq(realmMember.realmId, realmId),
					eq(realmMember.profileId, profileId),
					eq(realmMember.state, "active"),
				),
			),
	);
}

/**
 * Resolves the non-recursive Realm access-manager userset.
 *
 * @remarks
 * The userset contains the active Realm owner plus Profiles that hold an effective,
 * root-scoped `unit.access.manage` grant on the Realm directly or through an active
 * Realm-member subject. Access-manager usersets are intentionally not followed while
 * resolving another access-manager userset, which keeps the relationship graph acyclic.
 * Platform recovery authority remains a direct policy override and is not materialized
 * into this Realm-scoped audience.
 *
 * @internal
 */
export function profileCanManageRealmAccess(
	executor: DatabaseExecutor,
	realmId: AnyPgColumn,
	profileId: string,
): SQL {
	const sourceExists = exists(
		executor
			.select({ id: managerUnit.id })
			.from(managerUnit)
			.where(and(eq(managerUnit.id, realmId), isNull(managerUnit.deletedAt))),
	);
	const ownership = exists(
		executor
			.select({ id: managerOwnership.id })
			.from(managerOwnership)
			.where(
				and(
					eq(managerOwnership.unitId, realmId),
					eq(managerOwnership.profileId, profileId),
					isNull(managerOwnership.revokedAt),
				),
			),
	);
	const profileRestriction = exists(
		executor
			.select({ id: managerRestriction.id })
			.from(managerRestriction)
			.where(
				and(
					eq(managerRestriction.unitId, realmId),
					eq(managerRestriction.permission, "unit.access.manage"),
					sql`cardinality(${managerRestriction.scope}) = 0`,
					eq(managerRestriction.subjectKind, "profile"),
					eq(managerRestriction.profileId, profileId),
					isNull(managerRestriction.revokedAt),
					or(isNull(managerRestriction.expiresAt), sql`${managerRestriction.expiresAt} > now()`),
				),
			),
	);
	const realmRestriction = exists(
		executor
			.select({ id: managerRestriction.id })
			.from(managerRestriction)
			.where(
				and(
					eq(managerRestriction.unitId, realmId),
					eq(managerRestriction.permission, "unit.access.manage"),
					sql`cardinality(${managerRestriction.scope}) = 0`,
					eq(managerRestriction.subjectKind, "realm"),
					eq(managerRestriction.realmRelation, "member"),
					isNull(managerRestriction.revokedAt),
					or(isNull(managerRestriction.expiresAt), sql`${managerRestriction.expiresAt} > now()`),
					exists(
						executor
							.select({ id: managerRestrictionMember.profileId })
							.from(managerRestrictionMember)
							.where(
								and(
									eq(managerRestrictionMember.realmId, managerRestriction.realmId),
									eq(managerRestrictionMember.profileId, profileId),
									eq(managerRestrictionMember.state, "active"),
								),
							),
					),
				),
			),
	);
	const matchingGrant = exists(
		executor
			.select({ id: managerGrant.id })
			.from(managerGrant)
			.where(
				and(
					eq(managerGrant.unitId, realmId),
					eq(managerGrant.permission, "unit.access.manage"),
					sql`cardinality(${managerGrant.scope}) = 0`,
					isNull(managerGrant.revokedAt),
					or(isNull(managerGrant.expiresAt), sql`${managerGrant.expiresAt} > now()`),
					or(
						and(eq(managerGrant.subjectKind, "profile"), eq(managerGrant.profileId, profileId)),
						and(
							eq(managerGrant.subjectKind, "realm"),
							eq(managerGrant.realmRelation, "member"),
							exists(
								executor
									.select({ id: managerGrantMember.profileId })
									.from(managerGrantMember)
									.where(
										and(
											eq(managerGrantMember.realmId, managerGrant.realmId),
											eq(managerGrantMember.profileId, profileId),
											eq(managerGrantMember.state, "active"),
										),
									),
							),
						),
					),
				),
			),
	);
	return and(
		sourceExists,
		or(ownership, and(not(profileRestriction), not(realmRestriction), matchingGrant)),
	) as SQL;
}

/** Returns the SQL predicate for one dynamic Realm access subject. */
export function profileMatchesRealmAccessSubject(
	executor: DatabaseExecutor,
	realmId: AnyPgColumn,
	relation: SQLWrapper,
	profileId: string,
): SQL {
	return or(
		and(eq(relation, "member"), activeRealmMembership(executor, realmId, profileId)),
		and(eq(relation, "access_manager"), profileCanManageRealmAccess(executor, realmId, profileId)),
	) as SQL;
}

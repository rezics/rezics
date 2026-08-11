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
import { alias } from "drizzle-orm/pg-core";

import { database } from "../../database";
import { unit, unitAccessGrant, unitAccessRestriction, unitOwnership } from "../../database/schema";
import { getPlatformCapabilityCondition } from "../platform/query";
import { profileMatchesRealmAccessSubject } from "./realm-subject";
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
		or(isNull(unitAccessRestriction.expiresAt), sql`${unitAccessRestriction.expiresAt} > now()`),
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
					profileMatchesRealmAccessSubject(
						database,
						unitAccessRestriction.realmId,
						unitAccessRestriction.realmRelation,
						profileId,
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
							profileMatchesRealmAccessSubject(
								database,
								unitAccessGrant.realmId,
								unitAccessGrant.realmRelation,
								profileId,
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
			and(not(profileRestriction), not(realmRestriction), or(visible, matchingGrant)),
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

type ExplicitAnyScopeGrantSource =
	| { readonly kind: "profile" }
	| {
			readonly kind: "realm";
			readonly realmId: SQLWrapper;
			readonly realmRelation: SQLWrapper;
	  };

/**
 * Returns whether one explicit Profile/Realm assignment grants at least one
 * effective scope for a delegable permission.
 *
 * Unlike the ordinary point-decision predicate, this listing predicate does
 * not admit authenticated grants or the platform recovery override. Ownership
 * is optional because only the Profile candidate stream may be seeded by it.
 */
export function getExplicitUnitAnyScopePermissionCondition(
	profileId: string,
	permission: DelegableUnitPermission,
	options: {
		readonly source: ExplicitAnyScopeGrantSource;
		readonly includeOwnership: boolean;
	},
	target: Pick<UnitReadTarget, "id" | "deletedAt"> = unit,
): SQL {
	const candidateGrant = alias(unitAccessGrant, "explicit_any_scope_grant");
	const candidateRestriction = alias(unitAccessRestriction, "explicit_any_scope_restriction");
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
	const grantSubject =
		options.source.kind === "profile"
			? and(eq(candidateGrant.subjectKind, "profile"), eq(candidateGrant.profileId, profileId))
			: and(
					eq(candidateGrant.subjectKind, "realm"),
					sql`${candidateGrant.realmId} = ${options.source.realmId}`,
					sql`${candidateGrant.realmRelation} = ${options.source.realmRelation}`,
				);
	const applicableRestriction = exists(
		database
			.select({ id: candidateRestriction.id })
			.from(candidateRestriction)
			.where(
				and(
					eq(candidateRestriction.unitId, candidateGrant.unitId),
					eq(candidateRestriction.permission, permission),
					isNull(candidateRestriction.revokedAt),
					or(
						isNull(candidateRestriction.expiresAt),
						sql`${candidateRestriction.expiresAt} > now()`,
					),
					or(
						and(
							eq(candidateRestriction.subjectKind, "profile"),
							eq(candidateRestriction.profileId, profileId),
						),
						and(
							eq(candidateRestriction.subjectKind, "realm"),
							profileMatchesRealmAccessSubject(
								database,
								candidateRestriction.realmId,
								candidateRestriction.realmRelation,
								profileId,
							),
						),
					),
					sql`cardinality(${candidateRestriction.scope}) <= cardinality(${candidateGrant.scope})`,
					sql`(${candidateGrant.scope})[1:cardinality(${candidateRestriction.scope})] = ${candidateRestriction.scope}`,
				),
			),
	);
	const matchingGrant = exists(
		database
			.select({ id: candidateGrant.id })
			.from(candidateGrant)
			.where(
				and(
					eq(candidateGrant.unitId, target.id),
					eq(candidateGrant.permission, permission),
					grantSubject,
					isNull(candidateGrant.revokedAt),
					or(isNull(candidateGrant.expiresAt), sql`${candidateGrant.expiresAt} > now()`),
					not(applicableRestriction),
				),
			),
	);
	return and(
		isNull(target.deletedAt),
		options.includeOwnership ? or(ownership, matchingGrant) : matchingGrant,
	) as SQL;
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
					profileMatchesRealmAccessSubject(
						database,
						unitAccessRestriction.realmId,
						unitAccessRestriction.realmRelation,
						profileId,
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
							profileMatchesRealmAccessSubject(
								database,
								unitAccessGrant.realmId,
								unitAccessGrant.realmRelation,
								profileId,
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

import { and, eq, exists, inArray, isNull, not, or, sql, type SQLWrapper } from "drizzle-orm";

import { database } from "../../database";
import {
	capabilityGrant,
	realmMember,
	unit,
	unitAccessBinding,
	unitAccessRestriction,
} from "../../database/schema";

type UnitReadTarget = {
	readonly id: SQLWrapper;
	readonly status: SQLWrapper;
	readonly visibility: SQLWrapper;
	readonly moderationStatus: SQLWrapper;
	readonly deletedAt: SQLWrapper;
};

function activeBinding() {
	return and(
		isNull(unitAccessBinding.revokedAt),
		or(isNull(unitAccessBinding.expiresAt), sql`${unitAccessBinding.expiresAt} > now()`),
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

	const directProfileOwner = exists(
		database
			.select({ id: unitAccessBinding.id })
			.from(unitAccessBinding)
			.where(
				and(
					eq(unitAccessBinding.unitId, target.id),
					eq(unitAccessBinding.subjectKind, "profile"),
					eq(unitAccessBinding.profileId, profileId),
					eq(unitAccessBinding.role, "owner"),
					activeBinding(),
				),
			),
	);
	const notReadRestricted = not(
		exists(
			database
				.select({ id: unitAccessRestriction.id })
				.from(unitAccessRestriction)
				.where(
					and(
						eq(unitAccessRestriction.unitId, target.id),
						eq(unitAccessRestriction.permission, "unit.read"),
						sql`cardinality(${unitAccessRestriction.scope}) = 0`,
						isNull(unitAccessRestriction.revokedAt),
						or(
							isNull(unitAccessRestriction.expiresAt),
							sql`${unitAccessRestriction.expiresAt} > now()`,
						),
						or(
							and(
								eq(unitAccessRestriction.subjectKind, "profile"),
								eq(unitAccessRestriction.profileId, profileId),
							),
							and(
								eq(unitAccessRestriction.subjectKind, "realm"),
								not(directProfileOwner),
								exists(
									database
										.select({ profileId: realmMember.profileId })
										.from(realmMember)
										.where(
											and(
												eq(
													realmMember.realmId,
													unitAccessRestriction.realmId,
												),
												eq(realmMember.profileId, profileId),
												eq(realmMember.state, "active"),
											),
										),
								),
							),
						),
					),
				),
		),
	);
	const platformSubject = exists(
		database
			.select({ id: capabilityGrant.id })
			.from(capabilityGrant)
			.where(
				and(
					eq(capabilityGrant.authority, "platform"),
					eq(capabilityGrant.profileId, profileId),
					eq(capabilityGrant.capability, "unit.edit"),
					isNull(capabilityGrant.revokedAt),
					or(
						isNull(capabilityGrant.expiresAt),
						sql`${capabilityGrant.expiresAt} > now()`,
					),
				),
			),
	);
	const directOrAuthenticated = exists(
		database
			.select({ id: unitAccessBinding.id })
			.from(unitAccessBinding)
			.where(
				and(
					eq(unitAccessBinding.unitId, target.id),
					activeBinding(),
					or(
						and(
							eq(unitAccessBinding.subjectKind, "profile"),
							eq(unitAccessBinding.profileId, profileId),
						),
						eq(unitAccessBinding.subjectKind, "authenticated"),
					),
				),
			),
	);
	const realmSubject = exists(
		database
			.select({ id: unitAccessBinding.id })
			.from(unitAccessBinding)
			.innerJoin(
				realmMember,
				and(
					eq(realmMember.realmId, unitAccessBinding.realmId),
					eq(realmMember.profileId, profileId),
					eq(realmMember.state, "active"),
				),
			)
			.where(
				and(
					eq(unitAccessBinding.unitId, target.id),
					eq(unitAccessBinding.subjectKind, "realm"),
					activeBinding(),
					or(
						inArray(unitAccessBinding.realmRelation, ["member", "content_editor"]),
						and(
							eq(unitAccessBinding.realmRelation, "governor"),
							or(
								inArray(realmMember.role, ["owner", "admin"]),
								exists(
									database
										.select({ id: capabilityGrant.id })
										.from(capabilityGrant)
										.where(
											and(
												eq(capabilityGrant.authority, "realm"),
												eq(
													capabilityGrant.realmId,
													unitAccessBinding.realmId,
												),
												eq(capabilityGrant.profileId, profileId),
												eq(
													capabilityGrant.capability,
													"realm.settings.update",
												),
												isNull(capabilityGrant.revokedAt),
												or(
													isNull(capabilityGrant.expiresAt),
													sql`${capabilityGrant.expiresAt} > now()`,
												),
											),
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
			and(notReadRestricted, or(visible, directOrAuthenticated, realmSubject)),
		),
	);
}

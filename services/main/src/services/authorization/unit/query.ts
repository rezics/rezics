import { and, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";

import { database } from "../../database";
import {
	capabilityGrant,
	realmMember,
	unit,
	unitAccessBinding,
	unitAccessRestriction,
} from "../../database/schema";

function activeBinding() {
	return and(
		isNull(unitAccessBinding.revokedAt),
		or(isNull(unitAccessBinding.expiresAt), sql`${unitAccessBinding.expiresAt} > now()`),
	);
}

export function getUnitReadCondition(
	profileId?: string,
	options: { readonly discoverableOnly?: boolean } = {},
) {
	const visible = and(
		eq(unit.status, "published"),
		options.discoverableOnly
			? eq(unit.visibility, "public")
			: inArray(unit.visibility, ["public", "unlisted"]),
		eq(unit.moderationStatus, "approved"),
		isNull(unit.deletedAt),
	);
	if (!profileId) return visible;

	const notReadRestricted = sql`not exists (
		select 1 from ${unitAccessRestriction}
		where ${unitAccessRestriction.unitId} = ${unit.id}
			and ${unitAccessRestriction.profileId} = ${profileId}::uuid
			and ${unitAccessRestriction.permission} = 'unit.read'
			and cardinality(${unitAccessRestriction.scope}) = 0
			and ${unitAccessRestriction.revokedAt} is null
			and (${unitAccessRestriction.expiresAt} is null or ${unitAccessRestriction.expiresAt} > now())
	)`;
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
					eq(unitAccessBinding.unitId, unit.id),
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
					eq(unitAccessBinding.unitId, unit.id),
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
		isNull(unit.deletedAt),
		or(
			platformSubject,
			and(notReadRestricted, or(visible, directOrAuthenticated, realmSubject)),
		),
	);
}

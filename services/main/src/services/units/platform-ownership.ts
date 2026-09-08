import { and, eq, gt, inArray, isNull, sql, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import { UnitOwnershipChanged, UnitOwnershipTargetIneligible } from "../api/governance/errors";
import { recordAuditEvent } from "../audit";
import type { PlatformAuthorization } from "../authorization/platform/authorization";
import { lockUnitAccessState } from "../authorization/unit/invitations";
import { replaceUnitOwnership } from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import {
	entityIdentity,
	entityParticipation,
	unitOwnership,
	unitSlugAddress,
	authEntity,
	users,
	participationGrant,
} from "../database/schema";
import {
	createGovernanceDecision,
	type GovernanceRuleReference,
} from "../governance/decision-service";
import { createNotification } from "../notifications/service";
import { hasEntityController } from "../participation/lifecycle";
import { UnitNotFound } from "./errors";
import { readUnitStateById } from "./query";
import { readUnitPresentationsInTransaction } from "./presentation-reader";
import { resolveGovernanceLookup, type GovernanceLookupInput } from "./governance-lookup";

/** Same live-controller conditions as participation lifecycle; only bounded candidate IDs are evaluated. */
function controlledEntity(id: SQLWrapper) {
	return sql<boolean>`(
 exists(select 1 from ${authEntity} self_binding join ${users} account on account.id=self_binding.auth_user_id
 where self_binding.entity_id=${id} and self_binding.state='active' and account.erased_at is null)
 or exists(select 1 from ${participationGrant} security_grant join ${users} account on account.id=security_grant.auth_user_id
 join ${authEntity} self_binding on self_binding.auth_user_id=account.id
 where security_grant.acting_entity_id=${id} and security_grant.entity_id=${id} and security_grant.capability='entity.security'
 and security_grant.revoked_at is null and (security_grant.expires_at is null or security_grant.expires_at>now())
 and account.erased_at is null and self_binding.state='active')
)`;
}
export async function listPlatformOwnershipCandidates(
	authorization: PlatformAuthorization<string | undefined>,
	input: GovernanceLookupInput & {
		readonly unitId: string;
		readonly cursor?: string;
		readonly limit: number;
	},
) {
	const limit = z.number().int().min(1).max(50).parse(input.limit);
	return database.transaction(
		async (tx) => {
			await authorization.ensureCapability("unit.ownership.override", tx);
			if (
				!(await readUnitStateById(tx, input.unitId, {
					includeDeleted: true,
				}))
			)
				throw new UnitNotFound();
			const lookup = await resolveGovernanceLookup(tx, input);
			const candidates =
				lookup.kind === "exact"
					? input.cursor || !lookup.id
						? []
						: [{ id: lookup.id }]
					: await tx
							.select({ id: entityParticipation.entityId })
							.from(entityParticipation)
							.where(
								input.cursor
									? gt(entityParticipation.entityId, z.uuid().parse(input.cursor))
									: undefined,
							)
							.orderBy(entityParticipation.entityId)
							.limit(limit * 5);
			if (!candidates.length) return { items: [], nextCursor: null };
			const ids = candidates.map((row) => row.id);
			const rows = await tx
				.select({
					entityId: entityIdentity.id,
					slug: sql<
						string | null
					>`(select ${unitSlugAddress.slug} from ${unitSlugAddress} where ${unitSlugAddress.targetUnitId}=${entityIdentity.id} and ${unitSlugAddress.kind}='canonical' limit 1)`,
				})
				.from(entityIdentity)
				.innerJoin(entityParticipation, eq(entityParticipation.entityId, entityIdentity.id))
				.where(
					and(
						inArray(entityIdentity.id, ids),
						isNull(entityIdentity.deletedAt),
						eq(entityParticipation.state, "active"),
						controlledEntity(entityIdentity.id),
						sql`not exists(select 1 from ${unitOwnership} where ${unitOwnership.unitId}=${input.unitId} and ${unitOwnership.profileId}=${entityIdentity.id} and ${unitOwnership.revokedAt} is null)`,
					),
				)
				.orderBy(entityIdentity.id)
				.limit(ids.length);
			const page = rows.slice(0, limit);
			const presentations = await readUnitPresentationsInTransaction(
				tx,
				page.map((row) => row.entityId),
			);
			return {
				items: page.map((row) => ({
					...row,
					label: presentations.get(row.entityId)?.title ?? null,
				})),
				nextCursor:
					rows.length > limit
						? (page.at(-1)?.entityId ?? null)
						: lookup.kind === "browse" && candidates.length === limit * 5
							? (candidates.at(-1)?.id ?? null)
							: null,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}
async function lockUnit(tx: DatabaseTransaction, unitId: string) {
	if (
		!(await readUnitStateById(tx, unitId, {
			includeDeleted: true,
			lock: "update",
		}))
	)
		throw new UnitNotFound();
}
async function eligibleTarget(tx: DatabaseTransaction, entityId: string) {
	const [control] = await tx
		.select({ id: entityParticipation.entityId })
		.from(entityParticipation)
		.where(and(eq(entityParticipation.entityId, entityId), eq(entityParticipation.state, "active")))
		.limit(1)
		.for("update");
	if (!control || !(await hasEntityController(tx, entityId))) return undefined;
	const state = await readUnitStateById(tx, entityId, { lock: "share" });
	if (!state || state.reference.owner !== "entity") return undefined;
	const presentations = await readUnitPresentationsInTransaction(tx, [entityId]);
	return { entityId, label: presentations.get(entityId)?.title ?? null };
}

export async function overridePlatformUnitOwnership(
	authorization: PlatformAuthorization<string | undefined>,
	input: {
		readonly unitId: string;
		readonly expectedOwnerEntityId: string | null;
		readonly targetEntityId: string;
		readonly rules: readonly GovernanceRuleReference[];
		readonly note?: string;
	},
) {
	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [input.unitId]);
		await authorization.ensureCapability("unit.ownership.override", tx);
		if (!authorization.profileId || !authorization.authUserId)
			throw new UnitOwnershipTargetIneligible();
		await lockUnit(tx, input.unitId);
		const target = await eligibleTarget(tx, input.targetEntityId);
		if (!target) throw new UnitOwnershipTargetIneligible();
		const decision = await createGovernanceDecision(tx, {
			action: "unit.ownership.override",
			actorProfileId: authorization.profileId,
			authority: { kind: "platform" },
			targetUnitId: input.unitId,
			subject: { kind: "unit_ownership", id: input.unitId },
			basis: { kind: "rules", rules: input.rules },
		});

		const replaced = await replaceUnitOwnership(tx, {
			unitId: input.unitId,
			expectedOwnerProfileId: input.expectedOwnerEntityId,
			targetProfileId: input.targetEntityId,
			actorProfileId: authorization.profileId,
			now: new Date(),
		});
		if (!replaced.ok) {
			if (replaced.reason === "owner_unchanged") throw new UnitOwnershipTargetIneligible();
			throw new UnitOwnershipChanged();
		}

		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "auth", authUserId: authorization.authUserId },
			authority: { kind: "platform" },
			action: "unit.ownership.override",
			governanceDecisionId: decision.id,
			target: { kind: "unit", id: input.unitId },
			details: {
				previousOwnerEntityId: replaced.previousOwnerProfileId,
				ownerEntityId: target.entityId,
				...(input.note ? { note: input.note } : {}),
			},
		});
		if (replaced.previousOwnerProfileId)
			await createNotification(tx, {
				kind: "system",
				recipientEntityId: replaced.previousOwnerProfileId,
				actorProfileId: authorization.profileId,
				subjectUnitId: input.unitId,
				dedupeKey: `unit-ownership-override:${replaced.ownershipId}:previous`,
				payload: {
					type: "system_event",
					event: "unit_ownership_override",
					references: {
						ownershipId: replaced.ownershipId,
						role: "previous_owner",
					},
				},
			});
		await createNotification(tx, {
			kind: "system",
			recipientEntityId: target.entityId,
			actorProfileId: authorization.profileId,
			subjectUnitId: input.unitId,
			dedupeKey: `unit-ownership-override:${replaced.ownershipId}:owner`,
			payload: {
				type: "system_event",
				event: "unit_ownership_override",
				references: {
					ownershipId: replaced.ownershipId,
					role: "owner",
				},
			},
		});
		return { owner: target };
	});
}

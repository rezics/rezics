import { entityIdentity } from "../database/schema/catalog-identity";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import {
	authEntity,
	entityParticipation,
	entityRecoveryEvent,
	participationGrant,
	participationGrantEvent,
} from "../database/schema/participation";
import { platformCapabilityGrant } from "../database/schema/realm";
import { ParticipationDenied, requireParticipation, type ParticipationAuthority } from "./policy";

/** An explicit control-plane bound per account; history remains append-only and separately paginated. */
export const MaximumActiveParticipationGrants = 1_000;
export const MaximumControlledServicePrincipals = 100;
export const MaximumEntitySecurityControllers = 32;

/** All grant-producing commands share this serialized admission bound, including service creation and recovery. */
export async function reserveParticipationGrantCapacity(
	tx: DatabaseTransaction,
	principal: { kind: "auth" | "service"; id: string },
	slots = 1,
) {
	z.uuid().parse(principal.id);
	z.number().int().min(1).max(3).parse(slots);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`participation-grant:${principal.kind}:${principal.id}`}, 0))`,
	);
	const column =
		principal.kind === "auth"
			? participationGrant.authUserId
			: participationGrant.servicePrincipalId;
	const rows = await tx
		.select({ id: participationGrant.id })
		.from(participationGrant)
		.where(and(eq(column, principal.id), isNull(participationGrant.revokedAt)))
		.limit(MaximumActiveParticipationGrants - slots + 1);
	if (rows.length + slots > MaximumActiveParticipationGrants)
		throw new ParticipationDenied("Outstanding participation grant limit reached");
}

/** Serializes controller changes, erasure and protected Entity effects on the same owner row. */
export async function lockEntityControl(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	entityId: string,
) {
	const [account] = await tx
		.select({ erasedAt: users.erasedAt })
		.from(users)
		.where(eq(users.id, authority.principal.authUserId))
		.limit(1)
		.for("share");
	if (!account || account.erasedAt) throw new ParticipationDenied("Account is unavailable");
	const [control] = await tx
		.select()
		.from(entityParticipation)
		.where(eq(entityParticipation.entityId, entityId))
		.limit(1)
		.for("update");
	if (!control) throw new ParticipationDenied("Entity has not been admitted to participation");
	return control;
}

/** Considers current human controllers, including expiry, account erasure and suspended bindings. */
export async function hasEntityController(tx: DatabaseTransaction, entityId: string) {
	const [self] = await tx
		.select({ id: users.id })
		.from(authEntity)
		.innerJoin(users, eq(users.id, authEntity.authUserId))
		.where(
			and(
				eq(authEntity.entityId, entityId),
				eq(authEntity.state, "active"),
				isNull(users.erasedAt),
			),
		)
		.limit(1);
	if (self) return true;
	const [delegate] = await tx
		.select({ id: participationGrant.id })
		.from(participationGrant)
		.innerJoin(users, eq(users.id, participationGrant.authUserId))
		.innerJoin(authEntity, eq(authEntity.authUserId, users.id))
		.where(
			and(
				eq(participationGrant.actingEntityId, entityId),
				eq(participationGrant.entityId, entityId),
				eq(participationGrant.capability, "entity.security"),
				isNull(participationGrant.revokedAt),
				or(
					isNull(participationGrant.expiresAt),
					sql`${participationGrant.expiresAt} > statement_timestamp()`,
				),
				isNull(users.erasedAt),
				eq(authEntity.state, "active"),
			),
		)
		.limit(1);
	return delegate !== undefined;
}

/** Losing the final controller preserves the public identity and opens recovery instead of blocking account erasure. */
export async function suspendUncontrolledEntity(tx: DatabaseTransaction, entityId: string) {
	const [control] = await tx
		.select()
		.from(entityParticipation)
		.where(eq(entityParticipation.entityId, entityId))
		.limit(1)
		.for("update");
	if (!control || (await hasEntityController(tx, entityId))) return false;
	if (control.state === "active")
		await tx
			.update(entityParticipation)
			.set({ state: "recovery_required", revision: control.revision + 1 })
			.where(eq(entityParticipation.entityId, entityId));
	return true;
}

/** Only a currently admitted platform security manager may resolve an evidence-reviewed recovery. @alpha */
export async function recoverEntityController(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: {
		entityId: string;
		recipientAuthUserId: string;
		expectedRevision: number;
		evidence: string;
	},
) {
	z.uuid().parse(input.entityId);
	z.uuid().parse(input.recipientAuthUserId);
	z.number().int().positive().parse(input.expectedRevision);
	const evidence = z.string().trim().min(1).max(16_384).parse(input.evidence);
	if (Buffer.byteLength(evidence, "utf8") > 16_384)
		throw new ParticipationDenied("Recovery evidence is too large");
	if (authority.principal.kind !== "auth" || authority.grant)
		throw new ParticipationDenied("Recovery requires the operator's direct account authority");
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	const [platformGrant] = await tx
		.select({ id: platformCapabilityGrant.id, expiresAt: platformCapabilityGrant.expiresAt })
		.from(platformCapabilityGrant)
		.where(
			and(
				eq(platformCapabilityGrant.authUserId, authority.principal.authUserId),
				eq(platformCapabilityGrant.capability, "platform.access.manage"),
				isNull(platformCapabilityGrant.revokedAt),
				or(
					isNull(platformCapabilityGrant.expiresAt),
					sql`${platformCapabilityGrant.expiresAt} > statement_timestamp()`,
				),
			),
		)
		.limit(1)
		.for("share");
	if (!platformGrant)
		throw new ParticipationDenied("Platform security management authority is required");
	const [targetIdentity] = await tx.select().from(entityIdentity).where(eq(entityIdentity.id,input.entityId)).for("share");
 if (targetIdentity?.shape=== "organization") throw new ParticipationDenied("Org recovery requires the native context-bound recipient flow");
 const control = await lockEntityControl(tx, authority, input.entityId);
	if (
		control.revision !== input.expectedRevision ||
		(await hasEntityController(tx, input.entityId))
	)
		throw new ParticipationDenied("Entity control changed or still has a controller");
	if (platformGrant.expiresAt) {
		// Grant/control lock waits can outlive the candidate statement's deadline check.
		const current = await tx.execute<{ active: boolean }>(sql`select
			${platformGrant.expiresAt.toISOString()}::timestamptz > statement_timestamp() as active`);
		if (!current.rows[0]?.active)
			throw new ParticipationDenied("Platform security management authority expired");
	}
	const obsolete = await tx
		.select()
		.from(participationGrant)
		.where(
			and(
				eq(participationGrant.actingEntityId, input.entityId),
				eq(participationGrant.capability, "entity.security"),
				isNull(participationGrant.revokedAt),
			),
		)
		.limit(MaximumEntitySecurityControllers + 1);
	if (obsolete.length > MaximumEntitySecurityControllers)
		throw new Error("Entity security controller bound is violated");
	for (const grant of obsolete) {
		await tx
			.update(participationGrant)
			.set({ revokedAt: new Date(), revision: grant.revision + 1 })
			.where(eq(participationGrant.id, grant.id));
		await tx.insert(participationGrantEvent).values({
			grantId: grant.id,
			revision: grant.revision + 1,
			operation: "revoke",
			operatorAuthUserId: authority.principal.authUserId,
		});
	}
	const [recipient] = await tx
		.select({ id: users.id })
		.from(users)
		.innerJoin(authEntity, eq(authEntity.authUserId, users.id))
		.where(
			and(
				eq(users.id, input.recipientAuthUserId),
				isNull(users.erasedAt),
				eq(authEntity.state, "active"),
			),
		)
		.limit(1)
		.for("share");
	if (!recipient) throw new ParticipationDenied("Recovery recipient has no active human account");
	await reserveParticipationGrantCapacity(tx, { kind: "auth", id: recipient.id });
	const [grant] = await tx
		.insert(participationGrant)
		.values({
			authUserId: recipient.id,
			actingEntityId: input.entityId,
			entityId: input.entityId,
			capability: "entity.security",
			createdByAuthUserId: authority.principal.authUserId,
		})
		.returning({ id: participationGrant.id });
	if (!grant) throw new Error("Recovery grant insertion failed");
	await tx.insert(participationGrantEvent).values({
		grantId: grant.id,
		revision: 1,
		operation: "grant",
		operatorAuthUserId: authority.principal.authUserId,
	});
	const revision = control.revision + 1;
	await tx
		.update(entityParticipation)
		.set({ state: "active", revision })
		.where(eq(entityParticipation.entityId, input.entityId));
	await tx.insert(entityRecoveryEvent).values({
		entityId: input.entityId,
		revision,
		operatorAuthUserId: authority.principal.authUserId,
		recipientAuthUserId: recipient.id,
		evidence,
	});
	return { entityId: input.entityId, revision, grant: { id: grant.id, revision: 1 } };
}

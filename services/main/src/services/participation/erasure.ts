import { and, eq, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { database, type DatabaseTransaction } from "../database";
import { users, sessions, accounts, apikeys, verifications } from "../database/schema/auth";
import {
	accountErasure,
	AccountErasureStageValues,
	authEntity,
	participationGrant,
	participationGrantEvent,
	servicePrincipal,
} from "../database/schema/participation";
import { accountPreference } from "../database/schema/account-preference";
import {
	notification,
	notificationPreference,
	emailOutbox,
} from "../database/schema/communication";
import {
	contentStructureNodeProgress,
	unitProgress,
	unitProgressEntry,
} from "../database/schema/progress";
import { recommendationEvent, recommendationExclusion } from "../database/schema/recommendation";
import { studioResourceVisit } from "../database/schema/studio";
import { ParticipationDenied, requireParticipation, type ParticipationAuthority } from "./policy";
import {
	MaximumActiveParticipationGrants,
	MaximumControlledServicePrincipals,
	suspendUncontrolledEntity,
} from "./lifecycle";

/**
 * Immediately invalidates the actual human account and removes its self binding.
 * Published Entity authorship and immutable private operator evidence remain truthful.
 * Private data deletion resumes in bounded worker transactions and never blocks on final-controller transfer.
 * @alpha
 */
export async function eraseOwnAccount(tx: DatabaseTransaction, authority: ParticipationAuthority) {
	if (authority.principal.kind !== "auth" || authority.grant)
		throw new ParticipationDenied("Account erasure requires the operator's own fresh session");
	const authUserId = authority.principal.authUserId;
	const [account] = await tx
		.select()
		.from(users)
		.where(eq(users.id, authUserId))
		.limit(1)
		.for("update");
	if (!account || account.principalKind !== "human" || account.erasedAt)
		throw new ParticipationDenied("Account is unavailable");
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	const [binding] = await tx
		.select()
		.from(authEntity)
		.where(eq(authEntity.authUserId, authUserId))
		.limit(1);
	if (!binding || binding.entityId !== authority.actingEntityId)
		throw new ParticipationDenied("Account erasure cannot use a delegated Entity");
	const grants = await tx
		.select()
		.from(participationGrant)
		.where(and(eq(participationGrant.authUserId, authUserId), isNull(participationGrant.revokedAt)))
		.orderBy(participationGrant.id)
		.limit(MaximumActiveParticipationGrants + 1);
	if (grants.length > MaximumActiveParticipationGrants)
		throw new Error("Account participation grant bound is violated");
	const serviceActors = await tx
		.select()
		.from(servicePrincipal)
		.where(
			and(eq(servicePrincipal.createdByAuthUserId, authUserId), isNull(servicePrincipal.revokedAt)),
		)
		.orderBy(servicePrincipal.id)
		.limit(MaximumControlledServicePrincipals + 1);
	if (serviceActors.length > MaximumControlledServicePrincipals)
		throw new Error("Account service principal bound is violated");
	const now = new Date();
	await tx
		.insert(accountErasure)
		.values({ authUserId, selfEntityId: binding.entityId, priorEmail: account.email });
	await tx
		.update(users)
		.set({
			erasedAt: now,
			name: "",
			image: null,
			email: `erased-${authUserId}@account.invalid`,
			emailVerified: false,
			registrationContentLanguage: "en",
		})
		.where(eq(users.id, authUserId));
	await tx.delete(authEntity).where(eq(authEntity.authUserId, authUserId));
	for (const grant of grants) {
		await tx
			.update(participationGrant)
			.set({ revokedAt: now, revision: grant.revision + 1 })
			.where(eq(participationGrant.id, grant.id));
		await tx
			.insert(participationGrantEvent)
			.values({
				grantId: grant.id,
				revision: grant.revision + 1,
				operation: "revoke",
				operatorAuthUserId: authUserId,
			});
	}
	const controlledEntityIds = [
		...new Set([
			binding.entityId,
			...grants
				.filter((grant) => grant.capability === "entity.security")
				.map((grant) => grant.actingEntityId),
		]),
	].sort();
	for (const entityId of controlledEntityIds) await suspendUncontrolledEntity(tx, entityId);
	for (const principal of serviceActors) {
		if (await suspendUncontrolledEntity(tx, principal.entityId))
			await tx
				.update(servicePrincipal)
				.set({ revokedAt: now, revision: principal.revision + 1 })
				.where(eq(servicePrincipal.id, principal.id));
	}
	return { state: "erasing" as const };
}

async function deletePrivateBatch(tx: DatabaseTransaction, table: PgTable, predicate: SQL) {
	const result = await tx.execute<{ count: number }>(sql`
		with batch as materialized (select ctid from ${table} where ${predicate} limit 500 for update skip locked),
		deleted as (delete from ${table} where ctid in (select ctid from batch) returning 1)
		select count(*)::integer as count from deleted`);
	const deleted = result.rows[0]?.count ?? 0;
	if (deleted > 0) return { deleted, empty: false };
	const remaining = await tx.execute<{ present: boolean }>(
		sql`select exists(select 1 from ${table} where ${predicate}) as present`,
	);
	return { deleted, empty: !(remaining.rows[0]?.present ?? false) };
}

/** One locked job, one bounded deletion transaction; a crash rolls back both deletion and stage advancement. @internal */
export async function dispatchAccountErasureBatch() {
	return database.transaction(async (tx) => {
		const [job] = await tx
			.select()
			.from(accountErasure)
			.where(and(isNull(accountErasure.completedAt), lte(accountErasure.availableAt, new Date())))
			.orderBy(accountErasure.availableAt, accountErasure.authUserId)
			.limit(1)
			.for("update", { skipLocked: true });
		if (!job) return 0;
		const authId = job.authUserId;
		if (!job.selfEntityId || !job.priorEmail)
			throw new Error("Incomplete erasure job lost its private deletion keys");
		const entityId = job.selfEntityId;
		let result: { deleted: number; empty: boolean };
		switch (job.stage) {
			case "sessions":
				result = await deletePrivateBatch(tx, sessions, eq(sessions.userId, authId));
				break;
			case "credentials":
				result = await deletePrivateBatch(tx, accounts, eq(accounts.userId, authId));
				break;
			case "api_tokens":
				result = await deletePrivateBatch(tx, apikeys, eq(apikeys.referenceId, authId));
				break;
			case "verification":
				result = await deletePrivateBatch(
					tx,
					verifications,
					eq(verifications.identifier, job.priorEmail),
				);
				break;
			case "auth_mail":
				result = await deletePrivateBatch(
					tx,
					emailOutbox,
					eq(emailOutbox.recipientEmail, job.priorEmail),
				);
				break;
			case "preferences":
				result = await deletePrivateBatch(
					tx,
					accountPreference,
					eq(accountPreference.authUserId, authId),
				);
				break;
			case "notifications":
				result = await deletePrivateBatch(
					tx,
					notification,
					eq(notification.recipientAuthUserId, authId),
				);
				break;
			case "notification_preferences":
				result = await deletePrivateBatch(
					tx,
					notificationPreference,
					eq(notificationPreference.authUserId, authId),
				);
				break;
			case "progress_entries":
				result = await deletePrivateBatch(
					tx,
					unitProgressEntry,
					eq(unitProgressEntry.authUserId, authId),
				);
				break;
			case "progress_nodes":
				result = await deletePrivateBatch(
					tx,
					contentStructureNodeProgress,
					eq(contentStructureNodeProgress.authUserId, authId),
				);
				break;
			case "progress":
				result = await deletePrivateBatch(tx, unitProgress, eq(unitProgress.authUserId, authId));
				break;
			case "recommendation_events":
				result = await deletePrivateBatch(
					tx,
					recommendationEvent,
					eq(recommendationEvent.profileId, entityId),
				);
				break;
			case "recommendation_exclusions":
				result = await deletePrivateBatch(
					tx,
					recommendationExclusion,
					eq(recommendationExclusion.profileId, entityId),
				);
				break;
			case "studio_visits":
				result = await deletePrivateBatch(
					tx,
					studioResourceVisit,
					eq(studioResourceVisit.profileId, entityId),
				);
				break;
			case "complete":
				return 0;
		}
		const stage = result.empty
			? AccountErasureStageValues[AccountErasureStageValues.indexOf(job.stage) + 1]
			: job.stage;
		if (!stage) throw new Error("Erasure stage progression is invalid");
		await tx
			.update(accountErasure)
			.set({
				stage,
				completedBatches: job.completedBatches + 1,
				availableAt: new Date(Date.now() + 100),
				...(stage === "complete"
					? { completedAt: new Date(), selfEntityId: null, priorEmail: null }
					: {}),
			})
			.where(eq(accountErasure.authUserId, authId));
		return result.deleted;
	});
}

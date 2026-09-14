import { accountFollowPreference } from "../database/schema/follow";
import { governanceNoticeRecipient } from "../database/schema/governance-delivery";
import {
	organizationMembership,
	organizationMembershipEvent,
	organizationMembershipInvitation,
} from "../database/schema/organization-membership";
import { invalidateErasedMembershipInvitations } from "./membership";
import { erasePrivateImageBatch, type ImageErasureArchive } from "../image-assets/erasure";
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
import { eraseIdentityPreferenceBatch } from "../authorization/identity-preferences";
import { eraseAccountIdentityAdmissionBatch } from "../authorization/create-account-identity";
import {
	notification,
	notificationPreference,
	emailOutbox,
	message,
	conversationRead,
} from "../database/schema/communication";
import {
	notificationRecipientStat,
	conversationParticipantStat,
} from "../database/schema/aggregate";
import { accountEntityBlock } from "../database/schema/account-block";
import {
	accountFavorite,
	accountFavoriteRevision,
	accountFavoritesState,
} from "../database/schema/favorites";
import { accountRealmTagSubscription, accountUnitTag } from "../database/schema/tag";
import {
	apiQuotaRequestLease,
	apiQuotaDailyUsage,
	apiQuotaRateState,
	apiTokenCreationReservation,
	apiAccountQuotaBinding,
} from "../database/schema/api-quota";
import {
	contentStructureNodeProgress,
	unitProgress,
	unitProgressEntry,
} from "../database/schema/progress";
import { recommendationEvent, recommendationExclusion } from "../database/schema/recommendation";
import { studioResourceVisit, studioAuthEditorCandidate } from "../database/schema/studio";
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
		await tx.insert(participationGrantEvent).values({
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

async function deletePrivateBatch(
	tx: DatabaseTransaction,
	table: PgTable,
	predicate: SQL,
	limit = 500,
) {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
		throw new Error("Private erasure batch bound is invalid");
	const result = await tx.execute<{ count: number }>(sql`
		with batch as materialized (select ctid from ${table} where ${predicate} limit ${limit} for update skip locked),
		deleted as (delete from ${table} where ctid in (select ctid from batch) returning 1)
		select count(*)::integer as count from deleted`);
	const deleted = result.rows[0]?.count ?? 0;
	if (deleted > 0) return { deleted, empty: false };
	const remaining = await tx.execute<{ present: boolean }>(
		sql`select exists(select 1 from ${table} where ${predicate}) as present`,
	);
	return { deleted, empty: !(remaining.rows[0]?.present ?? false) };
}

/** Token children are drained by indexed token seeks before the token's two bounded one-row cascades. */
async function deletePrivateTokenBatch(tx: DatabaseTransaction, authUserId: string) {
	const [token] = await tx
		.select({ id: apikeys.id })
		.from(apikeys)
		.where(eq(apikeys.referenceId, authUserId))
		.limit(1)
		.for("update");
	if (!token) return { deleted: 0, empty: true };
	for (const table of [apiQuotaRequestLease, apiQuotaDailyUsage, apiQuotaRateState]) {
		const batch = await deletePrivateBatch(tx, table, eq(table.tokenId, token.id));
		if (!batch.empty) return batch;
	}
	await tx.delete(apikeys).where(eq(apikeys.id, token.id));
	return { deleted: 1, empty: false };
}

/** Tombstones preserve the other participant's read marker and chronological boundary. */
async function redactSentMessageBatch(tx: DatabaseTransaction, authUserId: string) {
	const result = await tx.execute<{ count: number }>(sql`
		with batch as materialized (select id from ${message} where sender_auth_user_id = ${authUserId}
			and content is not null limit 32 for update skip locked),
		redacted as (update ${message} set content = null, deleted_at = now(), updated_at = now()
			where id in (select id from batch) returning 1)
		select count(*)::integer as count from redacted`);
	const deleted = result.rows[0]?.count ?? 0;
	if (deleted > 0) return { deleted, empty: false };
	const remaining = await tx.execute<{
		present: boolean;
	}>(sql`select exists(select 1 from ${message}
		where sender_auth_user_id = ${authUserId} and content is not null) as present`);
	return { deleted, empty: !(remaining.rows[0]?.present ?? false) };
}

/** One locked job, one bounded deletion transaction; a crash rolls back both deletion and stage advancement. @internal */
export async function dispatchAccountErasureBatch(
	options: { archive?: ImageErasureArchive; authUserId?: string } = {},
) {
	return database.transaction(async (tx) => {
		const [job] = await tx
			.select()
			.from(accountErasure)
			.where(
				and(
					isNull(accountErasure.completedAt),
					lte(accountErasure.availableAt, new Date()),
					options.authUserId ? eq(accountErasure.authUserId, options.authUserId) : undefined,
				),
			)
			.orderBy(accountErasure.availableAt, accountErasure.authUserId)
			.limit(1)
			.for("update", { skipLocked: true });
		if (!job) return 0;
		const authId = job.authUserId;
		const [closedAccount] = await tx
			.select({ erasedAt: users.erasedAt })
			.from(users)
			.where(eq(users.id, authId))
			.limit(1)
			.for("share");
		if (!closedAccount?.erasedAt) throw new Error("Private erasure requires a closed Auth account");
		if (!job.selfEntityId || !job.priorEmail)
			throw new Error("Incomplete erasure job lost its private deletion keys");
		let result: { deleted: number; empty: boolean };
		switch (job.stage) {
			case "sessions":
				result = await deletePrivateBatch(tx, sessions, eq(sessions.userId, authId));
				break;
			case "credentials":
				result = await deletePrivateBatch(tx, accounts, eq(accounts.userId, authId));
				break;
			case "api_tokens":
				result = await deletePrivateTokenBatch(tx, authId);
				break;
			case "quota_account_leases":
				result = await deletePrivateBatch(
					tx,
					apiQuotaRequestLease,
					eq(apiQuotaRequestLease.accountUserId, authId),
				);
				break;
			case "quota_account_daily":
				result = await deletePrivateBatch(
					tx,
					apiQuotaDailyUsage,
					eq(apiQuotaDailyUsage.accountUserId, authId),
				);
				break;
			case "quota_account_rates":
				result = await deletePrivateBatch(
					tx,
					apiQuotaRateState,
					eq(apiQuotaRateState.accountUserId, authId),
				);
				break;
			case "quota_reservations":
				result = await deletePrivateBatch(
					tx,
					apiTokenCreationReservation,
					eq(apiTokenCreationReservation.accountUserId, authId),
				);
				break;
			case "quota_account_binding":
				result = await deletePrivateBatch(
					tx,
					apiAccountQuotaBinding,
					eq(apiAccountQuotaBinding.userId, authId),
				);
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
				result = await eraseAccountIdentityAdmissionBatch(tx, authId);
				if (!result.empty) break;
				result = await eraseIdentityPreferenceBatch(tx, authId);
				if (!result.empty) break;
				result = await deletePrivateBatch(
					tx,
					accountPreference,
					eq(accountPreference.authUserId, authId),
				);
				break;
			case "notifications":
				// Partitioned receipts require the composite key, never a cross-partition ctid delete.
				{
					const receipts = await tx.select({ postId: governanceNoticeRecipient.postId })
						.from(governanceNoticeRecipient).where(eq(governanceNoticeRecipient.authUserId, authId))
						.orderBy(governanceNoticeRecipient.postId).limit(500).for("update", { skipLocked: true });
					if (receipts.length) {
						await tx.delete(governanceNoticeRecipient).where(and(
							eq(governanceNoticeRecipient.authUserId, authId),
							sql`${governanceNoticeRecipient.postId} = any(${receipts.map(row => row.postId)}::uuid[])`,
						));
						result = { deleted: receipts.length, empty: false };
						break;
					}
					const [remaining] = await tx.select({ postId: governanceNoticeRecipient.postId })
						.from(governanceNoticeRecipient).where(eq(governanceNoticeRecipient.authUserId, authId)).limit(1);
					if (remaining) { result = { deleted: 0, empty: false }; break; }
				}
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
			case "notification_stats":
				result = await deletePrivateBatch(
					tx,
					notificationRecipientStat,
					eq(notificationRecipientStat.authUserId, authId),
				);
				break;
			case "sent_messages":
				result = await redactSentMessageBatch(tx, authId);
				break;
			case "conversation_reads":
				result = await deletePrivateBatch(
					tx,
					conversationRead,
					eq(conversationRead.authUserId, authId),
				);
				break;
			case "conversation_stats":
				result = await deletePrivateBatch(
					tx,
					conversationParticipantStat,
					eq(conversationParticipantStat.authUserId, authId),
				);
				break;
			case "account_blocks":
				result = await deletePrivateBatch(
					tx,
					accountEntityBlock,
					eq(accountEntityBlock.blockerAuthUserId, authId),
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
					eq(recommendationEvent.authUserId, authId),
				);
				break;
			case "recommendation_exclusions":
				result = await deletePrivateBatch(
					tx,
					recommendationExclusion,
					eq(recommendationExclusion.authUserId, authId),
				);
				break;
			case "studio_visits":
				result = await deletePrivateBatch(
					tx,
					studioResourceVisit,
					eq(studioResourceVisit.authUserId, authId),
				);
				break;
			case "studio_candidates":
				result = await deletePrivateBatch(
					tx,
					studioAuthEditorCandidate,
					eq(studioAuthEditorCandidate.authUserId, authId),
				);
				break;
			case "follow_preferences":
				result = await deletePrivateBatch(
					tx,
					accountFollowPreference,
					eq(accountFollowPreference.authUserId, authId),
				);
				break;
			case "membership_sent_invitations":
				result = await invalidateErasedMembershipInvitations(tx, authId);
				break;
			case "organization_memberships":
				result = await deletePrivateBatch(
					tx,
					organizationMembership,
					eq(organizationMembership.memberAuthUserId, authId),
				);
				break;
			case "organization_membership_events":
				result = await deletePrivateBatch(
					tx,
					organizationMembershipEvent,
					eq(organizationMembershipEvent.memberAuthUserId, authId),
				);
				break;
			case "membership_received_invitations":
				result = await deletePrivateBatch(
					tx,
					organizationMembershipInvitation,
					eq(organizationMembershipInvitation.recipientAuthUserId, authId),
				);
				break;
			case "favorite_history":
				result = await deletePrivateBatch(
					tx,
					accountFavoriteRevision,
					eq(accountFavoriteRevision.authUserId, authId),
					32,
				);
				break;
			case "favorites":
				result = await deletePrivateBatch(
					tx,
					accountFavorite,
					eq(accountFavorite.authUserId, authId),
					48,
				);
				break;
			case "favorites_state":
				result = await deletePrivateBatch(
					tx,
					accountFavoritesState,
					eq(accountFavoritesState.authUserId, authId),
				);
				break;
			case "tag_subscriptions":
				result = await deletePrivateBatch(
					tx,
					accountRealmTagSubscription,
					eq(accountRealmTagSubscription.authUserId, authId),
				);
				break;
			case "personal_tags":
				result = await deletePrivateBatch(
					tx,
					accountUnitTag,
					eq(accountUnitTag.authUserId, authId),
				);
				break;
			case "private_images":
				result = await erasePrivateImageBatch(tx, authId, options.archive);
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

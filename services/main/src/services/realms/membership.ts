import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Authorization } from "../authorization";
import { RealmRulesAcceptanceRequired } from "../authorization/errors";
import { isRealmJoinable } from "../authorization/realm/policy";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import {
	RealmNotFound,
	RealmMemberNotFound,
	RealmMembershipNotFound,
	RealmOwnerLeaveForbidden,
} from "../api/realms/errors";
import type { DatabaseTransaction } from "../database";
import {
	authEntity,
	realm,
	realmMember,
	realmRuleAcceptance,
	realmRuleRevision,
	unitFollow,
	unitOwnership,
	RealmMemberStateValues,
} from "../database/schema";
import { recordAuditEvent } from "../audit";
import { createNotification } from "../notifications/service";
import { lockUnitAccessState } from "../authorization/unit/access-lock";
import { ParticipationDenied } from "../participation/policy";
import { currentRealmRuleRevisionReadLock } from "./rule-revision-lock";

async function admitRealmAccount(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	action: "write" | "contribute",
) {
	const context = authorization.participationAuthority,
		authUserId = authorization.authUserId;
	if (!authUserId || !context || context.principal.authUserId !== authUserId)
		throw new ParticipationDenied();
	if (action === "contribute") await authorization.account.ensureCanContribute(tx);
	else await authorization.account.ensureCanWrite(tx);
	await ensureAccountAuthenticationAllowed(authUserId, tx);
	const [binding] = await tx
		.select({ entityId: authEntity.entityId })
		.from(authEntity)
		.where(
			and(
				eq(authEntity.authUserId, authUserId),
				eq(authEntity.entityId, authorization.profileId),
				eq(authEntity.state, "active"),
				eq(authEntity.revision, context.authorizationRevision),
			),
		)
		.limit(1)
		.for("share");
	if (!binding) throw new ParticipationDenied("Account self identity changed");
	return binding;
}

/** Join as the authenticated self under current Realm policy and rule consent. @internal */
export async function joinRealm(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	realmId: string,
) {
	z.uuid().parse(realmId);
	// Rule publication and Realm history commit hold the matching exclusive fence.
	// Read policy only after this wait; different members can share admission.
	await tx.execute(currentRealmRuleRevisionReadLock(realmId));
	const binding = await admitRealmAccount(tx, authorization, "contribute");
	const [record] = await tx
		.select({
			status: realm.status,
			visibility: realm.visibility,
			joinPolicy: realm.joinPolicy,
			deletedAt: realm.deletedAt,
			moderationStatus: realm.moderationStatus,
		})
		.from(realm)
		.where(eq(realm.id, realmId))
		.limit(1)
		.for("key share");
	if (!record || record.deletedAt || record.moderationStatus !== "approved")
		throw new RealmNotFound();
	const [current] = await tx
		.select({ state: realmMember.state })
		.from(realmMember)
		.where(and(eq(realmMember.realmId, realmId), eq(realmMember.profileId, binding.entityId)))
		.limit(1)
		.for("update");
	if (!isRealmJoinable(record.status, record.visibility, current?.state)) throw new RealmNotFound();
	const [rules] = await tx
		.select({
			id: realmRuleRevision.id,
			acknowledgementMode: realmRuleRevision.acknowledgementMode,
			requireOnJoin: realmRuleRevision.requireOnJoin,
		})
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, realmId))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	const acceptsOnFollow = rules?.acknowledgementMode === "implicit_on_follow";
	if (rules?.requireOnJoin && !acceptsOnFollow) {
		const [acceptance] = await tx
			.select({ revisionId: realmRuleAcceptance.revisionId })
			.from(realmRuleAcceptance)
			.where(
				and(
					eq(realmRuleAcceptance.revisionId, rules.id),
					eq(realmRuleAcceptance.profileId, binding.entityId),
				),
			)
			.limit(1);
		if (!acceptance) throw new RealmRulesAcceptanceRequired({ revisionId: rules.id });
	}
	let state: typeof realmMember.$inferSelect.state =
		current?.state === "active" || current?.state === "muted"
			? current.state
			: record.joinPolicy === "approval"
				? "pending"
				: "active";
	if (current?.state !== state) {
		const [joined] = await tx
			.insert(realmMember)
			.values({ realmId, profileId: binding.entityId, state })
			.onConflictDoUpdate({
				target: [realmMember.realmId, realmMember.profileId],
				// An absent row may have been inserted after the read. Do not overwrite
				// a concurrent moderator's decision when resolving that unique conflict.
				set: {
					state: sql`case when ${realmMember.state} in ('active', 'muted') then ${realmMember.state} else ${state}::realm_member_state end`,
				},
				setWhere: notInArray(realmMember.state, ["banned", "removed"]),
			})
			.returning({ state: realmMember.state });
		if (!joined) throw new RealmNotFound();
		state = joined.state;
	}
	await tx
		.insert(unitFollow)
		.values({ followerProfileId: binding.entityId, unitId: realmId })
		.onConflictDoNothing();
	if (rules && acceptsOnFollow)
		await tx
			.insert(realmRuleAcceptance)
			.values({ revisionId: rules.id, profileId: binding.entityId, language: null })
			.onConflictDoNothing();
	return { state };
}

/** Leave membership/follows without removing a moderator's retained restriction. @internal */
export async function leaveRealm(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	realmId: string,
) {
	z.uuid().parse(realmId);
	const binding = await admitRealmAccount(tx, authorization, "write");
	await lockUnitAccessState(tx, [realmId], "shared");
	const [membership] = await tx
		.select({ state: realmMember.state })
		.from(realmMember)
		.where(and(eq(realmMember.realmId, realmId), eq(realmMember.profileId, binding.entityId)))
		.limit(1)
		.for("update");
	if (!membership) throw new RealmMembershipNotFound();
	const [ownership] = await tx
		.select({ id: unitOwnership.id })
		.from(unitOwnership)
		.where(
			and(
				eq(unitOwnership.unitId, realmId),
				eq(unitOwnership.profileId, binding.entityId),
				isNull(unitOwnership.revokedAt),
			),
		)
		.limit(1);
	if (ownership) throw new RealmOwnerLeaveForbidden();
	// Inactive moderation rows are enforcement evidence, not removable self-service membership.
	if (membership.state === "active" || membership.state === "pending")
		await tx
			.delete(realmMember)
			.where(and(eq(realmMember.realmId, realmId), eq(realmMember.profileId, binding.entityId)));
	await tx
		.delete(unitFollow)
		.where(and(eq(unitFollow.unitId, realmId), eq(unitFollow.followerProfileId, binding.entityId)));
	const revisions = tx
		.select({ id: realmRuleRevision.id })
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, realmId));
	await tx
		.delete(realmRuleAcceptance)
		.where(
			and(
				eq(realmRuleAcceptance.profileId, binding.entityId),
				inArray(realmRuleAcceptance.revisionId, revisions),
			),
		);
}

/** Apply current member-management authority and owner continuity in the write transaction. @internal */
export async function updateRealmMember(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	realmId: string,
	profileId: string,
	state: typeof realmMember.$inferSelect.state,
) {
	z.uuid().parse(realmId);
	z.uuid().parse(profileId);
	z.enum(RealmMemberStateValues).parse(state);
	await admitRealmAccount(tx, authorization, "contribute");
	await authorization.realm.ensureCapabilityInTransaction(tx, realmId, "realm.members.manage");
	const [member] = await tx
		.select()
		.from(realmMember)
		.where(and(eq(realmMember.realmId, realmId), eq(realmMember.profileId, profileId)))
		.limit(1)
		.for("update");
	if (!member) throw new RealmMemberNotFound();
	const [ownership] = await tx
		.select({ id: unitOwnership.id })
		.from(unitOwnership)
		.where(
			and(
				eq(unitOwnership.unitId, realmId),
				eq(unitOwnership.profileId, profileId),
				isNull(unitOwnership.revokedAt),
			),
		)
		.limit(1);
	if (ownership && state !== "active") throw new RealmOwnerLeaveForbidden();
	const [row] = await tx
		.update(realmMember)
		.set({ state })
		.where(and(eq(realmMember.realmId, realmId), eq(realmMember.profileId, profileId)))
		.returning();
	if (!row) throw new RealmMemberNotFound();
	await createNotification(tx, {
		recipientEntityId: profileId,
		actorProfileId: authorization.profileId,
		kind: "realm",
		subjectUnitId: realmId,
		payload: { type: "realm_event", event: "membership_updated" },
	});
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: authorization.profileId },
		authority: { kind: "realm", id: realmId },
		action: "realm.members.update",
		target: { kind: "unit", id: realmId },
		details: { profileId },
	});
	return { ...row, isOwner: Boolean(ownership) };
}

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../../database";
import {
	auditEvent,
	profile,
	unitAccessBinding,
	unitAccessInvitation,
	UnitDelegableAccessRoleValues,
} from "../../database/schema";
import {
	UnitAccessBindingConflict,
	UnitAccessInvitationConflict,
	UnitAccessInvitationExpired,
	UnitAccessInvitationNotFound,
	UnitAccessInvitationSelfForbidden,
	UnitAccessRoleDelegationForbidden,
} from "../../api/governance/errors";
import { ProfileNotFound } from "../../api/users/errors";
import type { UnitAuthorization } from "./authorization";
import type { UnitScope } from "./scope";
import { createNotification } from "../../notifications/service";

export type UnitDelegableAccessRole = (typeof UnitDelegableAccessRoleValues)[number];
export type UnitAccessInvitationState =
	"pending" | "expired" | "accepted" | "declined" | "cancelled";

type InvitationRecord = typeof unitAccessInvitation.$inferSelect;
const DelegableAccessRoles: ReadonlySet<string> = new Set(UnitDelegableAccessRoleValues);

function isDelegableAccessRole(value: string): value is UnitDelegableAccessRole {
	return DelegableAccessRoles.has(value);
}

export function unitAccessInvitationState(
	record: Pick<InvitationRecord, "resolution" | "expiresAt">,
	now = new Date(),
): UnitAccessInvitationState {
	return record.resolution ?? (record.expiresAt <= now ? "expired" : "pending");
}

export function presentUnitAccessInvitation(record: InvitationRecord, now = new Date()) {
	if (!isDelegableAccessRole(record.role))
		throw new Error(`Unit access invitation has non-delegable role: ${record.role}`);
	return { ...record, role: record.role, state: unitAccessInvitationState(record, now) };
}

export async function lockUnitAccessState(
	tx: DatabaseTransaction,
	unitIds: readonly string[],
): Promise<void> {
	for (const unitId of [...new Set(unitIds)].sort())
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`unit-access:${unitId}`}::text, 0))`,
		);
}

function activeBinding(unitId: string, profileId: string, scope: UnitScope) {
	return and(
		eq(unitAccessBinding.unitId, unitId),
		eq(unitAccessBinding.subjectKind, "profile"),
		eq(unitAccessBinding.profileId, profileId),
		eq(unitAccessBinding.scope, [...scope]),
		isNull(unitAccessBinding.revokedAt),
		or(isNull(unitAccessBinding.expiresAt), sql`${unitAccessBinding.expiresAt} > now()`),
	);
}

async function recordInvitationAudit(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly action: string;
		readonly unitId: string;
		readonly invitationId: string;
		readonly metadata?: Record<string, unknown>;
	},
) {
	await tx.insert(auditEvent).values({
		actorProfileId: input.actorProfileId,
		action: input.action,
		decisionCode: "allowed",
		subjectKind: "unit_access_invitation",
		subjectId: input.invitationId,
		subjectPath: input.unitId,
		metadata: input.metadata,
	});
}

export async function createUnitAccessInvitation(
	authorization: UnitAuthorization<string>,
	actorProfileId: string,
	input: {
		readonly unitId: string;
		readonly invitedProfileId: string;
		readonly role: UnitDelegableAccessRole;
		readonly scope: UnitScope;
		readonly expiresAt: Date;
		readonly accessExpiresAt?: Date | null;
	},
) {
	if (input.invitedProfileId === actorProfileId) throw new UnitAccessInvitationSelfForbidden();
	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [input.unitId]);
		const decision = await authorization.decideInTransaction(
			tx,
			input.unitId,
			"unit.access.manage",
			input.scope,
		);
		if (!decision.allowed)
			await authorization.ensureInTransaction(
				tx,
				input.unitId,
				"unit.access.manage",
				input.scope,
			);
		if (
			input.role === "maintainer" &&
			decision.allowed &&
			decision.source !== "platform" &&
			!(decision.source === "binding" && decision.role === "owner")
		)
			throw new UnitAccessRoleDelegationForbidden();
		const [invitee] = await tx
			.select({ id: profile.id })
			.from(profile)
			.where(eq(profile.id, input.invitedProfileId))
			.limit(1);
		if (!invitee) throw new ProfileNotFound();
		const [binding] = await tx
			.select({ id: unitAccessBinding.id })
			.from(unitAccessBinding)
			.where(activeBinding(input.unitId, input.invitedProfileId, input.scope))
			.limit(1);
		if (binding) throw new UnitAccessBindingConflict();
		const [duplicate] = await tx
			.select({ id: unitAccessInvitation.id })
			.from(unitAccessInvitation)
			.where(
				and(
					eq(unitAccessInvitation.unitId, input.unitId),
					eq(unitAccessInvitation.invitedProfileId, input.invitedProfileId),
					eq(unitAccessInvitation.scope, [...input.scope]),
					isNull(unitAccessInvitation.resolution),
					sql`${unitAccessInvitation.expiresAt} > now()`,
				),
			)
			.limit(1);
		if (duplicate) throw new UnitAccessInvitationConflict();
		const [created] = await tx
			.insert(unitAccessInvitation)
			.values({
				unitId: input.unitId,
				invitedProfileId: input.invitedProfileId,
				role: input.role,
				scope: [...input.scope],
				invitedByProfileId: actorProfileId,
				expiresAt: input.expiresAt,
				accessExpiresAt: input.accessExpiresAt ?? null,
			})
			.returning();
		if (!created) throw new Error("Unit access invitation insertion returned no row");
		await recordInvitationAudit(tx, {
			actorProfileId,
			action: "unit.access_invitation.create",
			unitId: input.unitId,
			invitationId: created.id,
			metadata: {
				invitedProfileId: input.invitedProfileId,
				role: input.role,
				scope: input.scope,
			},
		});
		await createNotification(tx, {
			recipientProfileId: input.invitedProfileId,
			actorProfileId,
			subjectUnitId: input.unitId,
			kind: "system",
			payload: {
				type: "system_event",
				event: "unit_access_invitation",
				references: { invitationId: created.id },
			},
			dedupeKey: `unit-access-invitation:${created.id}`,
		});
		return { invitation: presentUnitAccessInvitation(created) };
	});
}

export async function listManagedUnitAccessInvitations(
	authorization: UnitAuthorization<string>,
	unitId: string,
	includeResolved: boolean,
) {
	await authorization.ensure(unitId, "unit.access.manage");
	const rows = await database
		.select()
		.from(unitAccessInvitation)
		.where(
			and(
				eq(unitAccessInvitation.unitId, unitId),
				includeResolved ? undefined : isNull(unitAccessInvitation.resolution),
			),
		)
		.orderBy(desc(unitAccessInvitation.createdAt), desc(unitAccessInvitation.id));
	const now = new Date();
	return rows.map((row) => presentUnitAccessInvitation(row, now));
}

export async function listReceivedUnitAccessInvitations(
	profileId: string,
	includeResolved: boolean,
) {
	const rows = await database
		.select()
		.from(unitAccessInvitation)
		.where(
			and(
				eq(unitAccessInvitation.invitedProfileId, profileId),
				includeResolved ? undefined : isNull(unitAccessInvitation.resolution),
			),
		)
		.orderBy(desc(unitAccessInvitation.createdAt), desc(unitAccessInvitation.id));
	const now = new Date();
	return rows.map((row) => presentUnitAccessInvitation(row, now));
}

async function unresolvedInvitation(tx: DatabaseTransaction, unitId: string, invitationId: string) {
	const [invitation] = await tx
		.select()
		.from(unitAccessInvitation)
		.where(
			and(
				eq(unitAccessInvitation.id, invitationId),
				eq(unitAccessInvitation.unitId, unitId),
				isNull(unitAccessInvitation.resolution),
			),
		)
		.limit(1);
	if (!invitation) throw new UnitAccessInvitationNotFound();
	if (invitation.expiresAt <= new Date()) throw new UnitAccessInvitationExpired();
	return invitation;
}

export async function acceptUnitAccessInvitation(
	profileId: string,
	unitId: string,
	invitationId: string,
) {
	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [unitId]);
		const invitation = await unresolvedInvitation(tx, unitId, invitationId);
		if (invitation.invitedProfileId !== profileId) throw new UnitAccessInvitationNotFound();
		if (invitation.accessExpiresAt && invitation.accessExpiresAt <= new Date())
			throw new UnitAccessInvitationExpired();
		const now = new Date();
		const supersededExpiredBindings = await tx
			.update(unitAccessBinding)
			.set({ revokedAt: now, revokedByProfileId: profileId })
			.where(
				and(
					eq(unitAccessBinding.unitId, unitId),
					eq(unitAccessBinding.subjectKind, "profile"),
					eq(unitAccessBinding.profileId, profileId),
					eq(unitAccessBinding.scope, invitation.scope),
					isNull(unitAccessBinding.revokedAt),
					sql`${unitAccessBinding.expiresAt} <= ${now}`,
				),
			)
			.returning({ id: unitAccessBinding.id });
		const [duplicate] = await tx
			.select({ id: unitAccessBinding.id })
			.from(unitAccessBinding)
			.where(activeBinding(unitId, profileId, invitation.scope))
			.limit(1);
		if (duplicate) throw new UnitAccessBindingConflict();
		const [binding] = await tx
			.insert(unitAccessBinding)
			.values({
				unitId,
				subjectKind: "profile",
				profileId,
				role: invitation.role,
				scope: invitation.scope,
				grantedByProfileId: invitation.invitedByProfileId,
				expiresAt: invitation.accessExpiresAt,
			})
			.returning();
		if (!binding) throw new Error("Accepted Unit access invitation returned no binding");
		const resolvedAt = new Date();
		const [resolved] = await tx
			.update(unitAccessInvitation)
			.set({
				resolution: "accepted",
				resolvedAt,
				resolvedByProfileId: profileId,
				acceptedBindingId: binding.id,
			})
			.where(
				and(
					eq(unitAccessInvitation.id, invitation.id),
					isNull(unitAccessInvitation.resolution),
				),
			)
			.returning();
		if (!resolved) throw new UnitAccessInvitationConflict();
		await recordInvitationAudit(tx, {
			actorProfileId: profileId,
			action: "unit.access_invitation.accept",
			unitId,
			invitationId,
			metadata: {
				bindingId: binding.id,
				supersededExpiredBindingIds: supersededExpiredBindings.map(({ id }) => id),
			},
		});
		return { invitation: presentUnitAccessInvitation(resolved), binding };
	});
}

export async function declineUnitAccessInvitation(
	profileId: string,
	unitId: string,
	invitationId: string,
) {
	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [unitId]);
		const invitation = await unresolvedInvitation(tx, unitId, invitationId);
		if (invitation.invitedProfileId !== profileId) throw new UnitAccessInvitationNotFound();
		const [resolved] = await tx
			.update(unitAccessInvitation)
			.set({ resolution: "declined", resolvedAt: new Date(), resolvedByProfileId: profileId })
			.where(
				and(
					eq(unitAccessInvitation.id, invitation.id),
					isNull(unitAccessInvitation.resolution),
				),
			)
			.returning();
		if (!resolved) throw new UnitAccessInvitationConflict();
		await recordInvitationAudit(tx, {
			actorProfileId: profileId,
			action: "unit.access_invitation.decline",
			unitId,
			invitationId,
		});
		return presentUnitAccessInvitation(resolved);
	});
}

export async function cancelUnitAccessInvitation(
	authorization: UnitAuthorization<string>,
	actorProfileId: string,
	unitId: string,
	invitationId: string,
) {
	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [unitId]);
		const invitation = await unresolvedInvitation(tx, unitId, invitationId);
		await authorization.ensureInTransaction(tx, unitId, "unit.access.manage", invitation.scope);
		const [resolved] = await tx
			.update(unitAccessInvitation)
			.set({
				resolution: "cancelled",
				resolvedAt: new Date(),
				resolvedByProfileId: actorProfileId,
			})
			.where(
				and(
					eq(unitAccessInvitation.id, invitation.id),
					isNull(unitAccessInvitation.resolution),
				),
			)
			.returning();
		if (!resolved) throw new UnitAccessInvitationConflict();
		await recordInvitationAudit(tx, {
			actorProfileId,
			action: "unit.access_invitation.cancel",
			unitId,
			invitationId,
		});
		return presentUnitAccessInvitation(resolved);
	});
}

export async function cancelPendingUnitAccessInvitations(
	tx: DatabaseTransaction,
	unitId: string,
	actorProfileId: string,
): Promise<string[]> {
	const rows = await tx
		.update(unitAccessInvitation)
		.set({
			resolution: "cancelled",
			resolvedAt: new Date(),
			resolvedByProfileId: actorProfileId,
		})
		.where(
			and(
				eq(unitAccessInvitation.unitId, unitId),
				isNull(unitAccessInvitation.resolution),
				sql`${unitAccessInvitation.expiresAt} > now()`,
			),
		)
		.returning({ id: unitAccessInvitation.id });
	return rows.map((row) => row.id);
}

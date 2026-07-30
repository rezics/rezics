import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DelegableUnitPermission } from "@rezics/access";

import { recordAuditEvent } from "../../audit";
import { database, type DatabaseTransaction } from "../../database";
import { profile, unitAccessGrant, unitAccessInvitation } from "../../database/schema";
import {
	UnitAccessConfigurationInvalid,
	UnitAccessInvitationConflict,
	UnitAccessInvitationExpired,
	UnitAccessInvitationNotFound,
	UnitAccessInvitationSelfForbidden,
} from "../../api/governance/errors";
import { ProfileNotFound } from "../../api/users/errors";
import { createNotification } from "../../notifications/service";
import type { UnitAuthorization } from "./authorization";
import { expandDelegableUnitPermissions } from "./policy";
import type { UnitScope } from "./scope";

export type UnitAccessInvitationState =
	"pending" | "expired" | "accepted" | "declined" | "cancelled";

type InvitationRecord = typeof unitAccessInvitation.$inferSelect;

export function unitAccessInvitationState(
	record: Pick<InvitationRecord, "resolution" | "expiresAt">,
	now = new Date(),
): UnitAccessInvitationState {
	return record.resolution ?? (record.expiresAt <= now ? "expired" : "pending");
}

export function presentUnitAccessInvitation(record: InvitationRecord, now = new Date()) {
	return { ...record, state: unitAccessInvitationState(record, now) };
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
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.unitId },
		action: input.action,
		target: {
			kind: "unit_access_invitation",
			id: input.invitationId,
			path: input.unitId,
		},
		details: input.metadata,
	});
}

export async function createUnitAccessInvitation(
	authorization: UnitAuthorization<string>,
	actorProfileId: string,
	input: {
		readonly unitId: string;
		readonly invitedProfileId: string;
		readonly permissions: readonly DelegableUnitPermission[];
		readonly scope: UnitScope;
		readonly expiresAt: Date;
		readonly accessExpiresAt?: Date | null;
	},
) {
	if (input.invitedProfileId === actorProfileId) throw new UnitAccessInvitationSelfForbidden();
	const permissions = expandDelegableUnitPermissions(input.permissions);
	if (!permissions.length) throw new UnitAccessConfigurationInvalid();

	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [input.unitId]);
		await authorization.ensureInTransaction(
			tx,
			input.unitId,
			"unit.access.manage",
			input.scope,
		);
		for (const permission of permissions)
			await authorization.ensureInTransaction(tx, input.unitId, permission, input.scope);

		const [invitee] = await tx
			.select({ id: profile.id })
			.from(profile)
			.where(eq(profile.id, input.invitedProfileId))
			.limit(1);
		if (!invitee) throw new ProfileNotFound();

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
				permissions,
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
				permissions,
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
		const supersededExpiredGrants = await tx
			.update(unitAccessGrant)
			.set({ revokedAt: now, revokedByProfileId: profileId })
			.where(
				and(
					eq(unitAccessGrant.unitId, unitId),
					eq(unitAccessGrant.subjectKind, "profile"),
					eq(unitAccessGrant.profileId, profileId),
					eq(unitAccessGrant.scope, invitation.scope),
					inArray(unitAccessGrant.permission, invitation.permissions),
					isNull(unitAccessGrant.revokedAt),
					sql`${unitAccessGrant.expiresAt} <= ${now}`,
				),
			)
			.returning({ id: unitAccessGrant.id });
		const existing = await tx
			.select({ permission: unitAccessGrant.permission })
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, unitId),
					eq(unitAccessGrant.subjectKind, "profile"),
					eq(unitAccessGrant.profileId, profileId),
					eq(unitAccessGrant.scope, invitation.scope),
					inArray(unitAccessGrant.permission, invitation.permissions),
					isNull(unitAccessGrant.revokedAt),
					or(
						isNull(unitAccessGrant.expiresAt),
						sql`${unitAccessGrant.expiresAt} > ${now}`,
					),
				),
			);
		const existingPermissions = new Set(existing.map(({ permission }) => permission));
		const missingPermissions = invitation.permissions.filter(
			(permission) => !existingPermissions.has(permission),
		);
		const grants = missingPermissions.length
			? await tx
					.insert(unitAccessGrant)
					.values(
						missingPermissions.map((permission) => ({
							unitId,
							subjectKind: "profile" as const,
							profileId,
							permission,
							scope: invitation.scope,
							grantedByProfileId: invitation.invitedByProfileId,
							expiresAt: invitation.accessExpiresAt,
						})),
					)
					.returning()
			: [];
		const resolvedAt = new Date();
		const [resolved] = await tx
			.update(unitAccessInvitation)
			.set({
				resolution: "accepted",
				resolvedAt,
				resolvedByProfileId: profileId,
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
				grantIds: grants.map(({ id }) => id),
				preexistingPermissions: [...existingPermissions],
				supersededExpiredGrantIds: supersededExpiredGrants.map(({ id }) => id),
			},
		});
		return { invitation: presentUnitAccessInvitation(resolved), grants };
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

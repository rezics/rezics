import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { PlatformGrantManagerRequired } from "../authorization/errors";
import {
	isPlatformCapability,
	isSuperAdminCapabilitySet,
	preservesPermanentGrantManager,
	type PlatformCapability,
} from "../authorization/platform/policy";
import { type DatabaseExecutor, type DatabaseTransaction } from "../database";
import { auditEvent, capabilityGrant, profile, users } from "../database/schema";
import { PlatformCapabilityValues } from "../database/schema/contract-values";
import { primaryUnitTitle } from "../units/localization";
import { CapabilityGrantExpiryInvalid } from "../api/governance/errors";
import { ProfileNotFound } from "../api/users/errors";

const PlatformAccessLockName = "platform-access-grants";

export interface StaffCapabilityGrant {
	readonly capability: PlatformCapability;
	readonly grantedByProfileId: string;
	readonly expiresAt: Date | null;
}

export interface StaffAccessProfile {
	readonly profileId: string;
	readonly name: string | null;
	readonly email: string;
	readonly grants: StaffCapabilityGrant[];
	readonly isSuperAdmin: boolean;
}

function activePlatformGrantPredicate() {
	return and(
		eq(capabilityGrant.authority, "platform"),
		isNull(capabilityGrant.realmId),
		isNull(capabilityGrant.revokedAt),
		or(isNull(capabilityGrant.expiresAt), sql`${capabilityGrant.expiresAt} > now()`),
	);
}

function presentStaffAccessProfile(input: {
	readonly profileId: string;
	readonly name: string | null;
	readonly email: string;
	readonly grants: readonly StaffCapabilityGrant[];
}): StaffAccessProfile {
	const capabilities = new Set(input.grants.map((grant) => grant.capability));
	return {
		...input,
		grants: PlatformCapabilityValues.flatMap((capability) => {
			const grant = input.grants.find((candidate) => candidate.capability === capability);
			return grant ? [grant] : [];
		}),
		isSuperAdmin: isSuperAdminCapabilitySet(capabilities),
	};
}

async function loadActivePlatformGrants(
	executor: DatabaseExecutor,
	profileIds: readonly string[],
): Promise<ReadonlyMap<string, readonly StaffCapabilityGrant[]>> {
	if (profileIds.length === 0) return new Map();
	const rows = await executor
		.select({
			profileId: capabilityGrant.profileId,
			capability: capabilityGrant.capability,
			grantedByProfileId: capabilityGrant.grantedByProfileId,
			expiresAt: capabilityGrant.expiresAt,
		})
		.from(capabilityGrant)
		.where(
			and(
				activePlatformGrantPredicate(),
				inArray(capabilityGrant.profileId, [...profileIds]),
			),
		);
	const grants = new Map<string, StaffCapabilityGrant[]>();
	for (const row of rows) {
		if (!isPlatformCapability(row.capability)) continue;
		const existing = grants.get(row.profileId) ?? [];
		existing.push({
			capability: row.capability,
			grantedByProfileId: row.grantedByProfileId,
			expiresAt: row.expiresAt,
		});
		grants.set(row.profileId, existing);
	}
	return grants;
}

export async function listStaffMembers(executor: DatabaseExecutor): Promise<StaffAccessProfile[]> {
	const rows = await executor
		.select({
			profileId: profile.id,
			name: primaryUnitTitle(profile.id),
			email: users.email,
		})
		.from(capabilityGrant)
		.innerJoin(profile, eq(profile.id, capabilityGrant.profileId))
		.innerJoin(users, eq(users.id, profile.authUserId))
		.where(activePlatformGrantPredicate())
		.groupBy(profile.id, users.email)
		.orderBy(users.email);
	const grants = await loadActivePlatformGrants(
		executor,
		rows.map(({ profileId }) => profileId),
	);
	return rows.flatMap((row) => {
		const profileGrants = grants.get(row.profileId) ?? [];
		return profileGrants.length
			? [presentStaffAccessProfile({ ...row, grants: profileGrants })]
			: [];
	});
}

export async function searchStaffProfiles(
	executor: DatabaseExecutor,
	query: string,
	limit: number,
): Promise<StaffAccessProfile[]> {
	const pattern = `%${query.trim()}%`;
	const rows = await executor
		.select({
			profileId: profile.id,
			name: primaryUnitTitle(profile.id),
			email: users.email,
		})
		.from(profile)
		.innerJoin(users, eq(users.id, profile.authUserId))
		.where(
			or(ilike(users.email, pattern), sql`${primaryUnitTitle(profile.id)} ilike ${pattern}`),
		)
		.orderBy(users.email)
		.limit(limit);
	const grants = await loadActivePlatformGrants(
		executor,
		rows.map(({ profileId }) => profileId),
	);
	return rows.map((row) =>
		presentStaffAccessProfile({
			...row,
			grants: grants.get(row.profileId) ?? [],
		}),
	);
}

export async function getStaffAccessProfile(
	executor: DatabaseExecutor,
	profileId: string,
): Promise<StaffAccessProfile> {
	const [row] = await executor
		.select({
			profileId: profile.id,
			name: primaryUnitTitle(profile.id),
			email: users.email,
		})
		.from(profile)
		.innerJoin(users, eq(users.id, profile.authUserId))
		.where(eq(profile.id, profileId))
		.limit(1);
	if (!row) throw new ProfileNotFound();
	const grants = await loadActivePlatformGrants(executor, [profileId]);
	return presentStaffAccessProfile({
		...row,
		grants: grants.get(profileId) ?? [],
	});
}

async function ensurePermanentGrantManagerContinuity(
	tx: DatabaseTransaction,
	targetProfileId: string,
	targetWillRemainPermanentManager: boolean,
): Promise<void> {
	if (targetWillRemainPermanentManager) return;
	const permanentManagers = await tx
		.select({ profileId: capabilityGrant.profileId })
		.from(capabilityGrant)
		.where(
			and(
				eq(capabilityGrant.authority, "platform"),
				isNull(capabilityGrant.realmId),
				eq(capabilityGrant.capability, "platform.grants.manage"),
				isNull(capabilityGrant.expiresAt),
				isNull(capabilityGrant.revokedAt),
			),
		)
		.groupBy(capabilityGrant.profileId);
	if (
		!preservesPermanentGrantManager(
			permanentManagers.map(({ profileId }) => profileId),
			targetProfileId,
			targetWillRemainPermanentManager,
		)
	)
		throw new PlatformGrantManagerRequired();
}

export async function lockPlatformAccessGrants(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${PlatformAccessLockName}::text, 0))`,
	);
}

export async function ensurePlatformGrantMutationContinuity(
	tx: DatabaseTransaction,
	input: {
		readonly profileId: string;
		readonly capability: string;
		readonly active: boolean;
		readonly expiresAt: Date | null;
	},
): Promise<void> {
	if (input.capability !== "platform.grants.manage") return;
	await ensurePermanentGrantManagerContinuity(
		tx,
		input.profileId,
		input.active && input.expiresAt === null,
	);
}

export async function replacePlatformAccess(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly targetProfileId: string;
		readonly capabilities: readonly PlatformCapability[];
		readonly expiresAt: Date | null;
	},
): Promise<StaffAccessProfile> {
	const now = new Date();
	if (input.expiresAt && input.expiresAt <= now) throw new CapabilityGrantExpiryInvalid();
	await lockPlatformAccessGrants(tx);
	await getStaffAccessProfile(tx, input.targetProfileId);
	const existingRows = await tx
		.select({
			capability: capabilityGrant.capability,
			expiresAt: capabilityGrant.expiresAt,
			revokedAt: capabilityGrant.revokedAt,
		})
		.from(capabilityGrant)
		.where(
			and(
				eq(capabilityGrant.authority, "platform"),
				isNull(capabilityGrant.realmId),
				eq(capabilityGrant.profileId, input.targetProfileId),
				inArray(capabilityGrant.capability, [...PlatformCapabilityValues]),
			),
		);
	const selected = new Set(input.capabilities);
	await ensurePermanentGrantManagerContinuity(
		tx,
		input.targetProfileId,
		selected.has("platform.grants.manage") && input.expiresAt === null,
	);
	const activeExisting = existingRows.filter(
		(row) => row.revokedAt === null && (row.expiresAt === null || row.expiresAt > now),
	);
	const before = activeExisting.flatMap((row) =>
		isPlatformCapability(row.capability) ? [row.capability] : [],
	);
	const removed = before.filter((capability) => !selected.has(capability));
	const expiresAtChanged = input.capabilities.some((capability) => {
		const row = activeExisting.find((candidate) => candidate.capability === capability);
		return !row || row.expiresAt?.getTime() !== input.expiresAt?.getTime();
	});
	const changed =
		removed.length > 0 || before.length !== input.capabilities.length || expiresAtChanged;
	for (const capability of input.capabilities)
		await tx
			.insert(capabilityGrant)
			.values({
				authority: "platform",
				realmId: null,
				profileId: input.targetProfileId,
				capability,
				grantedByProfileId: input.actorProfileId,
				expiresAt: input.expiresAt,
			})
			.onConflictDoUpdate({
				target: [
					capabilityGrant.authority,
					capabilityGrant.realmId,
					capabilityGrant.profileId,
					capabilityGrant.capability,
				],
				set: {
					grantedByProfileId: input.actorProfileId,
					expiresAt: input.expiresAt,
					revokedAt: null,
					revokedByProfileId: null,
					updatedAt: now,
				},
			});
	if (removed.length)
		await tx
			.update(capabilityGrant)
			.set({
				revokedAt: now,
				revokedByProfileId: input.actorProfileId,
				updatedAt: now,
			})
			.where(
				and(
					eq(capabilityGrant.authority, "platform"),
					isNull(capabilityGrant.realmId),
					eq(capabilityGrant.profileId, input.targetProfileId),
					inArray(capabilityGrant.capability, removed),
					isNull(capabilityGrant.revokedAt),
				),
			);
	if (changed)
		await tx.insert(auditEvent).values({
			actorProfileId: input.actorProfileId,
			action: "platform_access.replace",
			decisionCode: "allowed",
			subjectKind: "profile",
			subjectId: input.targetProfileId,
			metadata: {
				before,
				after: [...input.capabilities],
				expiresAt: input.expiresAt?.toISOString() ?? null,
			},
		});
	return getStaffAccessProfile(tx, input.targetProfileId);
}

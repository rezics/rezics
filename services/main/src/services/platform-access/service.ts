import { PlatformCapabilityValues, type PlatformCapability } from "@rezics/access";
import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import {
	PlatformAccessManagerRequired,
	PlatformAccessConfigurationInvalid,
	PlatformAccessRevisionConflict,
} from "../authorization/errors";
import { preservesPermanentAccessManager } from "../authorization/platform/policy";
import { recordAuditEvent } from "../audit";
import { CapabilityGrantExpiryInvalid } from "../api/governance/errors";
import { ProfileNotFound } from "../api/users/errors";
import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import { platformCapabilityGrant, profile, users } from "../database/schema";
import { firstUnitLocalizationTitle } from "../units/localization";

const PlatformAccessLockName = "platform-access-grants";

export interface PlatformAccessGrant {
	readonly id: string;
	readonly capability: PlatformCapability;
	readonly grantedByProfileId: string;
	readonly expiresAt: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export interface PlatformAccessProfile {
	readonly profileId: string;
	readonly name: string | null;
	readonly email: string;
	readonly grants: PlatformAccessGrant[];
	readonly revision: string;
}

export interface DesiredPlatformAccessGrant {
	readonly capability: PlatformCapability;
	readonly expiresAt: Date | null;
}

function activePlatformGrantPredicate(now = new Date()) {
	return and(
		isNull(platformCapabilityGrant.revokedAt),
		or(
			isNull(platformCapabilityGrant.expiresAt),
			sql`${platformCapabilityGrant.expiresAt} > ${now}`,
		),
	);
}

function platformAccessRevision(grants: readonly PlatformAccessGrant[]): string {
	if (grants.length === 0) return "empty";
	return [...grants]
		.sort((left, right) => left.id.localeCompare(right.id))
		.map((grant) => `${grant.id}@${grant.updatedAt.toISOString()}`)
		.join(".");
}

function orderGrants(grants: readonly PlatformAccessGrant[]): PlatformAccessGrant[] {
	const order = new Map(
		PlatformCapabilityValues.map((capability, index) => [capability, index] as const),
	);
	return [...grants].sort(
		(left, right) =>
			(order.get(left.capability) ?? Number.MAX_SAFE_INTEGER) -
				(order.get(right.capability) ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id),
	);
}

async function loadActivePlatformGrants(
	executor: DatabaseExecutor,
	profileIds: readonly string[],
): Promise<ReadonlyMap<string, readonly PlatformAccessGrant[]>> {
	if (profileIds.length === 0) return new Map();
	const rows = await executor
		.select({
			id: platformCapabilityGrant.id,
			profileId: platformCapabilityGrant.profileId,
			capability: platformCapabilityGrant.capability,
			grantedByProfileId: platformCapabilityGrant.grantedByProfileId,
			expiresAt: platformCapabilityGrant.expiresAt,
			createdAt: platformCapabilityGrant.createdAt,
			updatedAt: platformCapabilityGrant.updatedAt,
		})
		.from(platformCapabilityGrant)
		.where(
			and(
				activePlatformGrantPredicate(),
				inArray(platformCapabilityGrant.profileId, [...profileIds]),
			),
		);
	const grants = new Map<string, PlatformAccessGrant[]>();
	for (const { profileId, ...grant } of rows) {
		const existing = grants.get(profileId) ?? [];
		existing.push(grant);
		grants.set(profileId, existing);
	}
	return new Map(
		[...grants].map(([profileId, profileGrants]) => [profileId, orderGrants(profileGrants)]),
	);
}

function presentPlatformAccessProfile(
	row: Pick<PlatformAccessProfile, "profileId" | "name" | "email">,
	grants: readonly PlatformAccessGrant[],
): PlatformAccessProfile {
	return {
		...row,
		grants: [...grants],
		revision: platformAccessRevision(grants),
	};
}

export async function listPlatformAccessProfiles(
	executor: DatabaseExecutor,
): Promise<PlatformAccessProfile[]> {
	const rows = await executor
		.select({
			profileId: profile.id,
			name: firstUnitLocalizationTitle(profile.id),
			email: users.email,
		})
		.from(platformCapabilityGrant)
		.innerJoin(profile, eq(profile.id, platformCapabilityGrant.profileId))
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
		return profileGrants.length ? [presentPlatformAccessProfile(row, profileGrants)] : [];
	});
}

export async function searchPlatformAccessProfiles(
	executor: DatabaseExecutor,
	query: string,
	limit: number,
): Promise<PlatformAccessProfile[]> {
	const pattern = `%${query.trim()}%`;
	const rows = await executor
		.select({
			profileId: profile.id,
			name: firstUnitLocalizationTitle(profile.id),
			email: users.email,
		})
		.from(profile)
		.innerJoin(users, eq(users.id, profile.authUserId))
		.where(
			or(
				ilike(users.email, pattern),
				sql`${firstUnitLocalizationTitle(profile.id)} ilike ${pattern}`,
			),
		)
		.orderBy(users.email)
		.limit(limit);
	const grants = await loadActivePlatformGrants(
		executor,
		rows.map(({ profileId }) => profileId),
	);
	return rows.map((row) => presentPlatformAccessProfile(row, grants.get(row.profileId) ?? []));
}

export async function getPlatformAccessProfile(
	executor: DatabaseExecutor,
	profileId: string,
): Promise<PlatformAccessProfile> {
	const [row] = await executor
		.select({
			profileId: profile.id,
			name: firstUnitLocalizationTitle(profile.id),
			email: users.email,
		})
		.from(profile)
		.innerJoin(users, eq(users.id, profile.authUserId))
		.where(eq(profile.id, profileId))
		.limit(1);
	if (!row) throw new ProfileNotFound();
	const grants = await loadActivePlatformGrants(executor, [profileId]);
	return presentPlatformAccessProfile(row, grants.get(profileId) ?? []);
}

export async function lockPlatformAccess(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${PlatformAccessLockName}::text, 0))`,
	);
}

async function ensurePermanentAccessManagerContinuity(
	tx: DatabaseTransaction,
	targetProfileId: string,
	targetWillRemainPermanentManager: boolean,
): Promise<void> {
	if (targetWillRemainPermanentManager) return;
	const permanentManagers = await tx
		.select({ profileId: platformCapabilityGrant.profileId })
		.from(platformCapabilityGrant)
		.where(
			and(
				eq(platformCapabilityGrant.capability, "platform.access.manage"),
				isNull(platformCapabilityGrant.expiresAt),
				isNull(platformCapabilityGrant.revokedAt),
			),
		)
		.groupBy(platformCapabilityGrant.profileId);
	if (
		!preservesPermanentAccessManager(
			permanentManagers.map(({ profileId }) => profileId),
			targetProfileId,
			targetWillRemainPermanentManager,
		)
	)
		throw new PlatformAccessManagerRequired();
}

function sameExpiry(left: Date | null, right: Date | null): boolean {
	return left?.getTime() === right?.getTime();
}

export async function replacePlatformAccess(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly targetProfileId: string;
		readonly expectedRevision: string;
		readonly grants: readonly DesiredPlatformAccessGrant[];
	},
): Promise<PlatformAccessProfile> {
	const now = new Date();
	if (input.grants.some(({ expiresAt }) => expiresAt !== null && expiresAt <= now))
		throw new CapabilityGrantExpiryInvalid();
	await lockPlatformAccess(tx);
	const beforeProfile = await getPlatformAccessProfile(tx, input.targetProfileId);
	if (beforeProfile.revision !== input.expectedRevision) throw new PlatformAccessRevisionConflict();

	const desired = new Map(input.grants.map((grant) => [grant.capability, grant] as const));
	if (desired.size !== input.grants.length) throw new PlatformAccessConfigurationInvalid();
	await ensurePermanentAccessManagerContinuity(
		tx,
		input.targetProfileId,
		desired.get("platform.access.manage")?.expiresAt === null,
	);

	const currentRows = await tx
		.select({
			id: platformCapabilityGrant.id,
			capability: platformCapabilityGrant.capability,
			expiresAt: platformCapabilityGrant.expiresAt,
			revokedAt: platformCapabilityGrant.revokedAt,
		})
		.from(platformCapabilityGrant)
		.where(
			and(
				eq(platformCapabilityGrant.profileId, input.targetProfileId),
				isNull(platformCapabilityGrant.revokedAt),
			),
		);
	const keptCapabilities = new Set<PlatformCapability>();
	const revokeIds: string[] = [];
	for (const current of currentRows) {
		const requested = desired.get(current.capability);
		const stillActive = current.expiresAt === null || current.expiresAt > now;
		if (requested && stillActive && sameExpiry(current.expiresAt, requested.expiresAt))
			keptCapabilities.add(current.capability);
		else revokeIds.push(current.id);
	}
	if (revokeIds.length)
		await tx
			.update(platformCapabilityGrant)
			.set({
				revokedAt: now,
				revokedByProfileId: input.actorProfileId,
				updatedAt: now,
			})
			.where(inArray(platformCapabilityGrant.id, revokeIds));

	const insertedIds: string[] = [];
	for (const grant of desired.values()) {
		if (keptCapabilities.has(grant.capability)) continue;
		const [inserted] = await tx
			.insert(platformCapabilityGrant)
			.values({
				profileId: input.targetProfileId,
				capability: grant.capability,
				grantedByProfileId: input.actorProfileId,
				expiresAt: grant.expiresAt,
			})
			.returning({ id: platformCapabilityGrant.id });
		if (inserted) insertedIds.push(inserted.id);
	}

	if (revokeIds.length || insertedIds.length)
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "platform" },
			action: "platform.access.replace",
			target: { kind: "profile", id: input.targetProfileId },
			details: {
				before: beforeProfile.grants.map(({ capability, expiresAt }) => ({
					capability,
					expiresAt: expiresAt?.toISOString() ?? null,
				})),
				after: [...desired.values()].map(({ capability, expiresAt }) => ({
					capability,
					expiresAt: expiresAt?.toISOString() ?? null,
				})),
				revokedGrantIds: revokeIds,
				createdGrantIds: insertedIds,
			},
		});
	return getPlatformAccessProfile(tx, input.targetProfileId);
}

export async function ensurePlatformAccessContinuity(
	tx: DatabaseTransaction,
	input: {
		readonly profileId: string;
		readonly capability: PlatformCapability;
		readonly active: boolean;
		readonly expiresAt: Date | null;
	},
): Promise<void> {
	if (input.capability !== "platform.access.manage") return;
	await lockPlatformAccess(tx);
	await ensurePermanentAccessManagerContinuity(
		tx,
		input.profileId,
		input.active && input.expiresAt === null,
	);
}

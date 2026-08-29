import {
	CustomThemeExternalLiveAccessCapability,
	CustomThemeExternalLiveAccessManageCapability,
	PlatformCapabilityValues,
	type PlatformCapability,
} from "@rezics/access";
import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import {
	CustomThemeExternalLiveAccessSelfMutationForbidden,
	PlatformAccessManagerRequired,
	PlatformAccessConfigurationInvalid,
	PlatformAccessRevisionConflict,
} from "../authorization/errors";
import { preservesPermanentAccessManager } from "../authorization/platform/policy";
import { recordAuditEvent } from "../audit";
import { CapabilityGrantExpiryInvalid } from "../api/governance/errors";
import { ProfileNotFound } from "../api/users/errors";
import { BootstrapPlatformAdministratorProfile } from "../bootstrap/data/foundation";
import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import { platformCapabilityGrant, profile, users } from "../database/schema";
import { firstUnitLocalizationTitle } from "../units/localization";

const PlatformAccessLockName = "platform-access-grants";
export const MaximumCustomThemeExternalLiveAccessGrantDays = 90;
export const MaximumActiveCustomThemeExternalLiveAccessGrants = 1_000;
export const MaximumActiveCustomThemeExternalLiveAccessManagers = 100;
const MaximumCustomThemeExternalLiveAccessGrantMilliseconds =
	MaximumCustomThemeExternalLiveAccessGrantDays * 24 * 60 * 60 * 1_000;

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

interface CustomThemeExternalLiveAccessGrantFields {
	readonly id: string;
	readonly grantedByProfileId: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export type CustomThemeExternalLiveAccessGrant = CustomThemeExternalLiveAccessGrantFields &
	(
		| { readonly state: "permanent"; readonly expiresAt: null }
		| { readonly state: "granted" | "expired"; readonly expiresAt: Date }
	);

export interface CustomThemeExternalLiveAccessProfile {
	readonly profileId: string;
	readonly name: string | null;
	readonly email: string;
	readonly grant: CustomThemeExternalLiveAccessGrant | null;
	readonly revision: string;
}

export function isCustomThemeExternalLiveExpiryValid(
	expiresAt: Date | null,
	now: Date,
): expiresAt is Date {
	return Boolean(
		expiresAt &&
			expiresAt > now &&
			expiresAt.getTime() <= now.getTime() + MaximumCustomThemeExternalLiveAccessGrantMilliseconds,
	);
}

export function isPermanentBootstrapCustomThemeExternalLiveAccessGrant(input: {
	readonly profileId: string;
	readonly grantedByProfileId: string;
	readonly expiresAt: Date | null;
}): boolean {
	return (
		input.profileId === BootstrapPlatformAdministratorProfile.profileId &&
		input.grantedByProfileId === BootstrapPlatformAdministratorProfile.profileId &&
		input.expiresAt === null
	);
}

export function classifyCustomThemeExternalLiveAccessGrant(
	row: CustomThemeExternalLiveAccessGrantFields & {
		readonly profileId: string;
		readonly expiresAt: Date | null;
	},
	now: Date,
): CustomThemeExternalLiveAccessGrant {
	const fields = {
		id: row.id,
		grantedByProfileId: row.grantedByProfileId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
	if (row.expiresAt === null) {
		if (!isPermanentBootstrapCustomThemeExternalLiveAccessGrant(row))
			throw new Error(
				"Only the Bootstrap platform administrator may hold permanent external-live access",
			);
		return { ...fields, state: "permanent", expiresAt: null };
	}
	return {
		...fields,
		state: row.expiresAt > now ? "granted" : "expired",
		expiresAt: row.expiresAt,
	};
}

export type CustomThemePlatformAccessCapacityReason =
	| "external_live_access_grant_bound"
	| "external_live_access_manager_bound";

export function customThemePlatformAccessCapacityReason(input: {
	readonly activeAccessGrantCount: number;
	readonly activeAccessManagerCount: number;
	readonly addingAccessGrant: boolean;
	readonly addingAccessManager: boolean;
}): CustomThemePlatformAccessCapacityReason | null {
	if (
		input.addingAccessGrant &&
		input.activeAccessGrantCount >= MaximumActiveCustomThemeExternalLiveAccessGrants
	)
		return "external_live_access_grant_bound";
	if (
		input.addingAccessManager &&
		input.activeAccessManagerCount >= MaximumActiveCustomThemeExternalLiveAccessManagers
	)
		return "external_live_access_manager_bound";
	return null;
}

function ensureCustomThemeExternalLiveExpiry(
	expiresAt: Date | null,
	now: Date,
): asserts expiresAt is Date {
	if (!isCustomThemeExternalLiveExpiryValid(expiresAt, now))
		throw new CapabilityGrantExpiryInvalid();
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

async function ensureCustomThemePlatformAccessCapacity(
	tx: DatabaseTransaction,
	input: {
		readonly addingAccessGrant: boolean;
		readonly addingAccessManager: boolean;
	},
): Promise<void> {
	const now = new Date();
	const accessGrantRows = input.addingAccessGrant
		? await tx
				.select({ profileId: platformCapabilityGrant.profileId })
				.from(platformCapabilityGrant)
				.where(
					and(
						eq(platformCapabilityGrant.capability, CustomThemeExternalLiveAccessCapability),
						activePlatformGrantPredicate(now),
					),
				)
				.limit(MaximumActiveCustomThemeExternalLiveAccessGrants)
		: [];
	const accessManagerRows = input.addingAccessManager
		? await tx
				.selectDistinct({ profileId: platformCapabilityGrant.profileId })
				.from(platformCapabilityGrant)
				.where(
					and(
						inArray(platformCapabilityGrant.capability, [
							CustomThemeExternalLiveAccessManageCapability,
							"platform.access.manage",
						]),
						activePlatformGrantPredicate(now),
					),
				)
				.limit(MaximumActiveCustomThemeExternalLiveAccessManagers)
		: [];
	const reason = customThemePlatformAccessCapacityReason({
		activeAccessGrantCount: accessGrantRows.length,
		activeAccessManagerCount: accessManagerRows.length,
		...input,
	});
	if (reason) throw new PlatformAccessConfigurationInvalid({ reason });
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
	const requestedExternalLiveAccess = input.grants.find(
		({ capability }) => capability === CustomThemeExternalLiveAccessCapability,
	);
	const requestedExternalLiveAccessIsPermanentBootstrapGrant = Boolean(
		requestedExternalLiveAccess &&
			isPermanentBootstrapCustomThemeExternalLiveAccessGrant({
				profileId: input.targetProfileId,
				grantedByProfileId: input.actorProfileId,
				expiresAt: requestedExternalLiveAccess.expiresAt,
			}),
	);
	if (requestedExternalLiveAccess && !requestedExternalLiveAccessIsPermanentBootstrapGrant)
		ensureCustomThemeExternalLiveExpiry(requestedExternalLiveAccess.expiresAt, now);
	await lockPlatformAccess(tx);
	const beforeProfile = await getPlatformAccessProfile(tx, input.targetProfileId);
	if (beforeProfile.revision !== input.expectedRevision) throw new PlatformAccessRevisionConflict();

	const desired = new Map(input.grants.map((grant) => [grant.capability, grant] as const));
	if (desired.size !== input.grants.length) throw new PlatformAccessConfigurationInvalid();
	const activeBefore = new Set(beforeProfile.grants.map(({ capability }) => capability));
	const managedExternalLiveAccessBefore =
		activeBefore.has(CustomThemeExternalLiveAccessManageCapability) ||
		activeBefore.has("platform.access.manage");
	const managesExternalLiveAccessAfter =
		desired.has(CustomThemeExternalLiveAccessManageCapability) ||
		desired.has("platform.access.manage");
	await ensureCustomThemePlatformAccessCapacity(tx, {
		addingAccessGrant:
			desired.has(CustomThemeExternalLiveAccessCapability) &&
			!activeBefore.has(CustomThemeExternalLiveAccessCapability),
		addingAccessManager: managesExternalLiveAccessAfter && !managedExternalLiveAccessBefore,
	});
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
	const currentExternalLiveAccess = currentRows.find(
		({ capability }) => capability === CustomThemeExternalLiveAccessCapability,
	);
	const externalLiveAccessChanges = requestedExternalLiveAccess
		? !currentExternalLiveAccess ||
			!sameExpiry(requestedExternalLiveAccess.expiresAt, currentExternalLiveAccess.expiresAt)
		: currentExternalLiveAccess !== undefined;
	if (
		externalLiveAccessChanges &&
		input.actorProfileId === input.targetProfileId &&
		!requestedExternalLiveAccessIsPermanentBootstrapGrant
	)
		throw new CustomThemeExternalLiveAccessSelfMutationForbidden();
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

function customThemeExternalLiveAccessRevision(
	grant: Pick<CustomThemeExternalLiveAccessGrant, "id" | "updatedAt"> | null,
): string {
	return grant ? `${grant.id}@${grant.updatedAt.toISOString()}` : "empty";
}

async function loadCurrentCustomThemeExternalLiveAccessGrants(
	executor: DatabaseExecutor,
	profileIds: readonly string[],
	now = new Date(),
): Promise<ReadonlyMap<string, CustomThemeExternalLiveAccessGrant>> {
	if (profileIds.length === 0) return new Map();
	const rows = await executor
		.select({
			id: platformCapabilityGrant.id,
			profileId: platformCapabilityGrant.profileId,
			grantedByProfileId: platformCapabilityGrant.grantedByProfileId,
			expiresAt: platformCapabilityGrant.expiresAt,
			createdAt: platformCapabilityGrant.createdAt,
			updatedAt: platformCapabilityGrant.updatedAt,
		})
		.from(platformCapabilityGrant)
		.where(
			and(
				inArray(platformCapabilityGrant.profileId, [...profileIds]),
				eq(platformCapabilityGrant.capability, CustomThemeExternalLiveAccessCapability),
				isNull(platformCapabilityGrant.revokedAt),
			),
		);
	const grants = new Map<string, CustomThemeExternalLiveAccessGrant>();
	for (const row of rows)
		grants.set(row.profileId, classifyCustomThemeExternalLiveAccessGrant(row, now));
	return grants;
}

function presentCustomThemeExternalLiveAccessProfile(
	row: Pick<CustomThemeExternalLiveAccessProfile, "profileId" | "name" | "email">,
	grant: CustomThemeExternalLiveAccessGrant | null,
): CustomThemeExternalLiveAccessProfile {
	return {
		...row,
		grant,
		revision: customThemeExternalLiveAccessRevision(grant),
	};
}

export async function getCustomThemeExternalLiveAccessProfile(
	executor: DatabaseExecutor,
	profileId: string,
): Promise<CustomThemeExternalLiveAccessProfile> {
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
	const grants = await loadCurrentCustomThemeExternalLiveAccessGrants(executor, [profileId]);
	return presentCustomThemeExternalLiveAccessProfile(row, grants.get(profileId) ?? null);
}

export async function searchCustomThemeExternalLiveAccessProfiles(
	executor: DatabaseExecutor,
	input: { readonly query?: string; readonly limit: number },
): Promise<CustomThemeExternalLiveAccessProfile[]> {
	const selection = executor
		.select({
			profileId: profile.id,
			name: firstUnitLocalizationTitle(profile.id),
			email: users.email,
		})
		.from(profile)
		.innerJoin(users, eq(users.id, profile.authUserId));
	const rows = input.query
		? await selection
				.where(
					or(
						ilike(users.email, `%${input.query.trim()}%`),
						sql`${firstUnitLocalizationTitle(profile.id)} ilike ${`%${input.query.trim()}%`}`,
					),
				)
				.orderBy(users.email, profile.id)
				.limit(input.limit)
		: await selection.orderBy(users.email, profile.id).limit(input.limit);
	const grants = await loadCurrentCustomThemeExternalLiveAccessGrants(
		executor,
		rows.map(({ profileId }) => profileId),
	);
	return rows.map((row) =>
		presentCustomThemeExternalLiveAccessProfile(row, grants.get(row.profileId) ?? null),
	);
}

export async function setCustomThemeExternalLiveAccess(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly targetProfileId: string;
		readonly expectedRevision: string;
		readonly state: "granted" | "revoked";
		readonly expiresAt?: Date;
	},
): Promise<CustomThemeExternalLiveAccessProfile> {
	const now = new Date();
	const expiresAt = input.state === "granted" ? (input.expiresAt ?? null) : null;
	if (input.state === "granted") {
		const permanentBootstrapGrant = isPermanentBootstrapCustomThemeExternalLiveAccessGrant({
			profileId: input.targetProfileId,
			grantedByProfileId: input.actorProfileId,
			expiresAt,
		});
		if (!permanentBootstrapGrant) {
			if (input.actorProfileId === input.targetProfileId)
				throw new CustomThemeExternalLiveAccessSelfMutationForbidden();
			ensureCustomThemeExternalLiveExpiry(expiresAt, now);
		}
	} else if (input.actorProfileId === input.targetProfileId) {
		throw new CustomThemeExternalLiveAccessSelfMutationForbidden();
	}
	await lockPlatformAccess(tx);
	const before = await getCustomThemeExternalLiveAccessProfile(tx, input.targetProfileId);
	if (before.revision !== input.expectedRevision) throw new PlatformAccessRevisionConflict();
	await ensureCustomThemePlatformAccessCapacity(tx, {
		addingAccessGrant:
			input.state === "granted" && (before.grant === null || before.grant.state === "expired"),
		addingAccessManager: false,
	});
	const [current] = await tx
		.select({ id: platformCapabilityGrant.id })
		.from(platformCapabilityGrant)
		.where(
			and(
				eq(platformCapabilityGrant.profileId, input.targetProfileId),
				eq(platformCapabilityGrant.capability, CustomThemeExternalLiveAccessCapability),
				isNull(platformCapabilityGrant.revokedAt),
			),
		)
		.limit(1);
	if (current)
		await tx
			.update(platformCapabilityGrant)
			.set({
				revokedAt: now,
				revokedByProfileId: input.actorProfileId,
				updatedAt: now,
			})
			.where(eq(platformCapabilityGrant.id, current.id));

	let createdGrantId: string | null = null;
	if (input.state === "granted") {
		const [created] = await tx
			.insert(platformCapabilityGrant)
			.values({
				profileId: input.targetProfileId,
				capability: CustomThemeExternalLiveAccessCapability,
				grantedByProfileId: input.actorProfileId,
				expiresAt,
			})
			.returning({ id: platformCapabilityGrant.id });
		if (!created) throw new Error("External-live access grant insertion returned no row");
		createdGrantId = created.id;
	}

	if (current || createdGrantId)
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "platform" },
			action:
				input.state === "revoked"
					? "platform.custom_theme.external_live.access.revoke"
					: before.grant
						? "platform.custom_theme.external_live.access.renew"
						: "platform.custom_theme.external_live.access.grant",
			target: { kind: "profile", id: input.targetProfileId },
			details: {
				previousGrantId: current?.id ?? null,
				createdGrantId,
				expiresAt: expiresAt?.toISOString() ?? null,
			},
		});
	return getCustomThemeExternalLiveAccessProfile(tx, input.targetProfileId);
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

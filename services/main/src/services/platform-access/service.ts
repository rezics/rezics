import {
	CustomThemeExternalLiveAccessCapability,
	CustomThemeExternalLiveAccessManageCapability,
	PlatformCapabilityValues,
	type PlatformCapability,
} from "@rezics/access";
import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { CapabilityGrantExpiryInvalid } from "../api/governance/errors";
import { UserNotFound } from "../api/users/errors";
import { recordAuditEvent } from "../audit";
import {
	CustomThemeExternalLiveAccessSelfMutationForbidden,
	PlatformAccessConfigurationInvalid,
	PlatformAccessManagerRequired,
	PlatformAccessRevisionConflict,
} from "../authorization/errors";
import { PlatformAuthorization } from "../authorization/platform/authorization";
import { preservesPermanentAccessManager } from "../authorization/platform/policy";
import { BootstrapPlatformAdministratorProfile } from "../bootstrap/data/foundation";
import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import { platformCapabilityGrant, users } from "../database/schema";

const PlatformAccessLockName = "platform-access-grants";
export const MaximumCustomThemeExternalLiveAccessGrantDays = 90;
export const MaximumActiveCustomThemeExternalLiveAccessGrants = 1_000;
export const MaximumActiveCustomThemeExternalLiveAccessManagers = 100;
const MaximumCustomThemeExternalLiveAccessGrantMilliseconds =
	MaximumCustomThemeExternalLiveAccessGrantDays * 24 * 60 * 60 * 1_000;

export interface PlatformAccessGrant {
	readonly id: string;
	readonly capability: PlatformCapability;
	readonly grantedByAuthUserId: string;
	readonly expiresAt: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export interface PlatformAccessAccount {
	readonly authUserId: string;
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
	readonly grantedByAuthUserId: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export type CustomThemeExternalLiveAccessGrant = CustomThemeExternalLiveAccessGrantFields &
	(
		| { readonly state: "permanent"; readonly expiresAt: null }
		| { readonly state: "granted" | "expired"; readonly expiresAt: Date }
	);

export interface CustomThemeExternalLiveAccessAccount {
	readonly authUserId: string;
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
	readonly authUserId: string;
	readonly grantedByAuthUserId: string;
	readonly expiresAt: Date | null;
}): boolean {
	return (
		input.authUserId === BootstrapPlatformAdministratorProfile.authUserId &&
		input.grantedByAuthUserId === BootstrapPlatformAdministratorProfile.authUserId &&
		input.expiresAt === null
	);
}

export function classifyCustomThemeExternalLiveAccessGrant(
	row: CustomThemeExternalLiveAccessGrantFields & {
		readonly authUserId: string;
		readonly expiresAt: Date | null;
	},
	now: Date,
): CustomThemeExternalLiveAccessGrant {
	const fields = {
		id: row.id,
		grantedByAuthUserId: row.grantedByAuthUserId,
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
	authUserIds: readonly string[],
): Promise<ReadonlyMap<string, readonly PlatformAccessGrant[]>> {
	if (authUserIds.length === 0) return new Map();
	const rows = await executor
		.select({
			id: platformCapabilityGrant.id,
			authUserId: platformCapabilityGrant.authUserId,
			capability: platformCapabilityGrant.capability,
			grantedByAuthUserId: platformCapabilityGrant.grantedByAuthUserId,
			expiresAt: platformCapabilityGrant.expiresAt,
			createdAt: platformCapabilityGrant.createdAt,
			updatedAt: platformCapabilityGrant.updatedAt,
		})
		.from(platformCapabilityGrant)
		.where(
			and(
				activePlatformGrantPredicate(),
				inArray(platformCapabilityGrant.authUserId, [...authUserIds]),
			),
		);
	const grants = new Map<string, PlatformAccessGrant[]>();
	for (const { authUserId, ...grant } of rows) {
		const existing = grants.get(authUserId) ?? [];
		existing.push(grant);
		grants.set(authUserId, existing);
	}
	return new Map(
		[...grants].map(([authUserId, profileGrants]) => [authUserId, orderGrants(profileGrants)]),
	);
}

function presentPlatformAccessAccount(
	row: Pick<PlatformAccessAccount, "authUserId" | "name" | "email">,
	grants: readonly PlatformAccessGrant[],
): PlatformAccessAccount {
	return {
		...row,
		grants: [...grants],
		revision: platformAccessRevision(grants),
	};
}

export async function listPlatformAccessAccounts(
	executor: DatabaseExecutor,
): Promise<PlatformAccessAccount[]> {
	const rows = await executor
		.select({
			authUserId: users.id,
			name: users.name,
			email: users.email,
		})
		.from(platformCapabilityGrant)
		.innerJoin(users, eq(users.id, platformCapabilityGrant.authUserId))
		.where(activePlatformGrantPredicate())
		.groupBy(users.id, users.name, users.email)
		.orderBy(users.email);
	const grants = await loadActivePlatformGrants(
		executor,
		rows.map(({ authUserId }) => authUserId),
	);
	return rows.flatMap((row) => {
		const profileGrants = grants.get(row.authUserId) ?? [];
		return profileGrants.length ? [presentPlatformAccessAccount(row, profileGrants)] : [];
	});
}

export async function searchPlatformAccessAccounts(
	executor: DatabaseExecutor,
	query: string,
	limit: number,
): Promise<PlatformAccessAccount[]> {
	const pattern = `%${query.trim()}%`;
	const rows = await executor
		.select({
			authUserId: users.id,
			name: users.name,
			email: users.email,
		})
		.from(users)
		.where(or(ilike(users.email, pattern), sql`${users.name} ilike ${pattern}`))
		.orderBy(users.email)
		.limit(limit);
	const grants = await loadActivePlatformGrants(
		executor,
		rows.map(({ authUserId }) => authUserId),
	);
	return rows.map((row) => presentPlatformAccessAccount(row, grants.get(row.authUserId) ?? []));
}

export async function getPlatformAccessAccount(
	executor: DatabaseExecutor,
	authUserId: string,
): Promise<PlatformAccessAccount> {
	const [row] = await executor
		.select({
			authUserId: users.id,
			name: users.name,
			email: users.email,
		})
		.from(users)
		.where(eq(users.id, authUserId))
		.limit(1);
	if (!row) throw new UserNotFound();
	const grants = await loadActivePlatformGrants(executor, [authUserId]);
	return presentPlatformAccessAccount(row, grants.get(authUserId) ?? []);
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
				.select({ authUserId: platformCapabilityGrant.authUserId })
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
				.selectDistinct({ authUserId: platformCapabilityGrant.authUserId })
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
	targetAuthUserId: string,
	targetWillRemainPermanentManager: boolean,
): Promise<void> {
	if (targetWillRemainPermanentManager) return;
	const permanentManagers = await tx
		.select({ authUserId: platformCapabilityGrant.authUserId })
		.from(platformCapabilityGrant)
		.where(
			and(
				eq(platformCapabilityGrant.capability, "platform.access.manage"),
				isNull(platformCapabilityGrant.expiresAt),
				isNull(platformCapabilityGrant.revokedAt),
			),
		)
		.groupBy(platformCapabilityGrant.authUserId);
	if (
		!preservesPermanentAccessManager(
			permanentManagers.map(({ authUserId }) => authUserId),
			targetAuthUserId,
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
		readonly actorAuthUserId: string;
		readonly targetAuthUserId: string;
		readonly expectedRevision: string;
		readonly grants: readonly DesiredPlatformAccessGrant[];
	},
): Promise<PlatformAccessAccount> {
	const now = new Date();
	if (input.grants.some(({ expiresAt }) => expiresAt !== null && expiresAt <= now))
		throw new CapabilityGrantExpiryInvalid();
	const requestedExternalLiveAccess = input.grants.find(
		({ capability }) => capability === CustomThemeExternalLiveAccessCapability,
	);
	const requestedExternalLiveAccessIsPermanentBootstrapGrant = Boolean(
		requestedExternalLiveAccess &&
			isPermanentBootstrapCustomThemeExternalLiveAccessGrant({
				authUserId: input.targetAuthUserId,
				grantedByAuthUserId: input.actorAuthUserId,
				expiresAt: requestedExternalLiveAccess.expiresAt,
			}),
	);
	if (requestedExternalLiveAccess && !requestedExternalLiveAccessIsPermanentBootstrapGrant)
		ensureCustomThemeExternalLiveExpiry(requestedExternalLiveAccess.expiresAt, now);
	await lockPlatformAccess(tx);
	await new PlatformAuthorization(undefined, input.actorAuthUserId).ensureCapability(
		"platform.access.manage",
		tx,
	);
	const beforeProfile = await getPlatformAccessAccount(tx, input.targetAuthUserId);
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
		input.targetAuthUserId,
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
				eq(platformCapabilityGrant.authUserId, input.targetAuthUserId),
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
		input.actorAuthUserId === input.targetAuthUserId &&
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
				revokedByAuthUserId: input.actorAuthUserId,
				updatedAt: now,
			})
			.where(inArray(platformCapabilityGrant.id, revokeIds));

	const insertedIds: string[] = [];
	for (const grant of desired.values()) {
		if (keptCapabilities.has(grant.capability)) continue;
		const [inserted] = await tx
			.insert(platformCapabilityGrant)
			.values({
				authUserId: input.targetAuthUserId,
				capability: grant.capability,
				grantedByAuthUserId: input.actorAuthUserId,
				expiresAt: grant.expiresAt,
			})
			.returning({ id: platformCapabilityGrant.id });
		if (inserted) insertedIds.push(inserted.id);
	}

	if (revokeIds.length || insertedIds.length)
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "auth", authUserId: input.actorAuthUserId },
			authority: { kind: "platform" },
			action: "platform.access.replace",
			target: { kind: "auth", id: input.targetAuthUserId },
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
	return getPlatformAccessAccount(tx, input.targetAuthUserId);
}

function customThemeExternalLiveAccessRevision(
	grant: Pick<CustomThemeExternalLiveAccessGrant, "id" | "updatedAt"> | null,
): string {
	return grant ? `${grant.id}@${grant.updatedAt.toISOString()}` : "empty";
}

async function loadCurrentCustomThemeExternalLiveAccessGrants(
	executor: DatabaseExecutor,
	authUserIds: readonly string[],
	now = new Date(),
): Promise<ReadonlyMap<string, CustomThemeExternalLiveAccessGrant>> {
	if (authUserIds.length === 0) return new Map();
	const rows = await executor
		.select({
			id: platformCapabilityGrant.id,
			authUserId: platformCapabilityGrant.authUserId,
			grantedByAuthUserId: platformCapabilityGrant.grantedByAuthUserId,
			expiresAt: platformCapabilityGrant.expiresAt,
			createdAt: platformCapabilityGrant.createdAt,
			updatedAt: platformCapabilityGrant.updatedAt,
		})
		.from(platformCapabilityGrant)
		.where(
			and(
				inArray(platformCapabilityGrant.authUserId, [...authUserIds]),
				eq(platformCapabilityGrant.capability, CustomThemeExternalLiveAccessCapability),
				isNull(platformCapabilityGrant.revokedAt),
			),
		);
	const grants = new Map<string, CustomThemeExternalLiveAccessGrant>();
	for (const row of rows)
		grants.set(row.authUserId, classifyCustomThemeExternalLiveAccessGrant(row, now));
	return grants;
}

function presentCustomThemeExternalLiveAccessAccount(
	row: Pick<CustomThemeExternalLiveAccessAccount, "authUserId" | "name" | "email">,
	grant: CustomThemeExternalLiveAccessGrant | null,
): CustomThemeExternalLiveAccessAccount {
	return {
		...row,
		grant,
		revision: customThemeExternalLiveAccessRevision(grant),
	};
}

export async function getCustomThemeExternalLiveAccessAccount(
	executor: DatabaseExecutor,
	authUserId: string,
): Promise<CustomThemeExternalLiveAccessAccount> {
	const [row] = await executor
		.select({
			authUserId: users.id,
			name: users.name,
			email: users.email,
		})
		.from(users)
		.where(eq(users.id, authUserId))
		.limit(1);
	if (!row) throw new UserNotFound();
	const grants = await loadCurrentCustomThemeExternalLiveAccessGrants(executor, [authUserId]);
	return presentCustomThemeExternalLiveAccessAccount(row, grants.get(authUserId) ?? null);
}

export async function searchCustomThemeExternalLiveAccessAccounts(
	executor: DatabaseExecutor,
	input: { readonly query?: string; readonly limit: number },
): Promise<CustomThemeExternalLiveAccessAccount[]> {
	const selection = executor
		.select({
			authUserId: users.id,
			name: users.name,
			email: users.email,
		})
		.from(users);
	const rows = input.query
		? await selection
				.where(
					or(
						ilike(users.email, `%${input.query.trim()}%`),
						sql`${users.name} ilike ${`%${input.query.trim()}%`}`,
					),
				)
				.orderBy(users.email, users.id)
				.limit(input.limit)
		: await selection.orderBy(users.email, users.id).limit(input.limit);
	const grants = await loadCurrentCustomThemeExternalLiveAccessGrants(
		executor,
		rows.map(({ authUserId }) => authUserId),
	);
	return rows.map((row) =>
		presentCustomThemeExternalLiveAccessAccount(row, grants.get(row.authUserId) ?? null),
	);
}

export async function setCustomThemeExternalLiveAccess(
	tx: DatabaseTransaction,
	input: {
		readonly actorAuthUserId: string;
		readonly targetAuthUserId: string;
		readonly expectedRevision: string;
		readonly state: "granted" | "revoked";
		readonly expiresAt?: Date;
	},
): Promise<CustomThemeExternalLiveAccessAccount> {
	const now = new Date();
	const expiresAt = input.state === "granted" ? (input.expiresAt ?? null) : null;
	if (input.state === "granted") {
		const permanentBootstrapGrant = isPermanentBootstrapCustomThemeExternalLiveAccessGrant({
			authUserId: input.targetAuthUserId,
			grantedByAuthUserId: input.actorAuthUserId,
			expiresAt,
		});
		if (!permanentBootstrapGrant) {
			if (input.actorAuthUserId === input.targetAuthUserId)
				throw new CustomThemeExternalLiveAccessSelfMutationForbidden();
			ensureCustomThemeExternalLiveExpiry(expiresAt, now);
		}
	} else if (input.actorAuthUserId === input.targetAuthUserId) {
		throw new CustomThemeExternalLiveAccessSelfMutationForbidden();
	}
	await lockPlatformAccess(tx);
	await new PlatformAuthorization(undefined, input.actorAuthUserId).ensureCapability(
		CustomThemeExternalLiveAccessManageCapability,
		tx,
	);
	const before = await getCustomThemeExternalLiveAccessAccount(tx, input.targetAuthUserId);
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
				eq(platformCapabilityGrant.authUserId, input.targetAuthUserId),
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
				revokedByAuthUserId: input.actorAuthUserId,
				updatedAt: now,
			})
			.where(eq(platformCapabilityGrant.id, current.id));

	let createdGrantId: string | null = null;
	if (input.state === "granted") {
		const [created] = await tx
			.insert(platformCapabilityGrant)
			.values({
				authUserId: input.targetAuthUserId,
				capability: CustomThemeExternalLiveAccessCapability,
				grantedByAuthUserId: input.actorAuthUserId,
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
			actor: { kind: "auth", authUserId: input.actorAuthUserId },
			authority: { kind: "platform" },
			action:
				input.state === "revoked"
					? "platform.custom_theme.external_live.access.revoke"
					: before.grant
						? "platform.custom_theme.external_live.access.renew"
						: "platform.custom_theme.external_live.access.grant",
			target: { kind: "auth", id: input.targetAuthUserId },
			details: {
				previousGrantId: current?.id ?? null,
				createdGrantId,
				expiresAt: expiresAt?.toISOString() ?? null,
			},
		});
	return getCustomThemeExternalLiveAccessAccount(tx, input.targetAuthUserId);
}

export async function ensurePlatformAccessContinuity(
	tx: DatabaseTransaction,
	input: {
		readonly authUserId: string;
		readonly capability: PlatformCapability;
		readonly active: boolean;
		readonly expiresAt: Date | null;
	},
): Promise<void> {
	if (input.capability !== "platform.access.manage") return;
	await lockPlatformAccess(tx);
	await ensurePermanentAccessManagerContinuity(
		tx,
		input.authUserId,
		input.active && input.expiresAt === null,
	);
}

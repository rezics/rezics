import { hashPassword } from "better-auth/crypto";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../database";
import {
	accounts,
	profile,
	profilePreference,
	realm,
	realmMember,
	realmUnit,
	unit,
	unitAccessBinding,
	unitLocalization,
	unitDock,
	unitSlugAddress,
	users,
	zone,
} from "../database/schema";
import { InitialFractionalPosition } from "../ordering/position";
import { insertUnit, insertUnitIfMissing } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { type BootstrapCredentialMode, generateBootstrapPassword } from "./credentials";
import {
	assertBootstrapManifest,
	BootstrapAccountIds,
	BootstrapAuthUserIds,
	BootstrapEpochIso,
	BootstrapUnitIds,
	OfficialProfileIdValues,
	OfficialProfileManifest,
	OfficialRealmManifest,
	OfficialZoneManifest,
	SlugNamespaceManifest,
	TopLevelSlugNamespaceUnitIds,
} from "./manifest";

const BootstrapLockName = "rezics-bootstrap";

export interface IssuedBootstrapCredential {
	readonly action: "created" | "overwritten";
	readonly name: string;
	readonly email: string;
	readonly password: string;
}

export interface BootstrapResult {
	readonly issuedCredentials: readonly IssuedBootstrapCredential[];
}

export interface BootstrapOptions {
	readonly credentialMode: BootstrapCredentialMode;
}

interface PreparedCredential {
	readonly password: string;
	readonly passwordHash: string;
}

const FillBootstrapOptions: BootstrapOptions = { credentialMode: "fill" };

function bootstrapEpoch(): Date {
	return new Date(BootstrapEpochIso);
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
	if (actual instanceof Date && expected instanceof Date)
		return actual.getTime() === expected.getTime();
	return actual === expected;
}

function assertFields(
	label: string,
	actual: Record<string, unknown> | undefined,
	expected: Record<string, unknown>,
): void {
	if (!actual) throw new Error(`Bootstrap ${label} was not created`);
	for (const [key, expectedValue] of Object.entries(expected)) {
		if (!valuesEqual(actual[key], expectedValue))
			throw new Error(
				`Bootstrap ${label} has unexpected ${key}: expected ${String(expectedValue)}, received ${String(actual[key])}`,
			);
	}
}

async function ensureSlugNamespaces(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	for (const namespace of SlugNamespaceManifest) {
		const created = await insertUnitIfMissing(tx, {
			id: namespace.id,
			kind: "slug_namespace",
			status: "published",
			visibility: "public",
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
			statusActor: { kind: "system" },
		});
		const [stored] = await tx
			.select({
				id: unit.id,
				kind: unit.kind,
				status: unit.status,
				visibility: unit.visibility,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(eq(unit.id, namespace.id))
			.limit(1);
		assertFields(`slug namespace ${namespace.slug}`, stored, {
			id: namespace.id,
			kind: "slug_namespace",
			status: "published",
			visibility: "public",
			deletedAt: null,
		});
		await tx
			.insert(unitSlugAddress)
			.values({
				kind: "canonical",
				scopeUnitId: null,
				slug: namespace.slug,
				targetUnitId: namespace.id,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing();
		const [storedAddress] = await tx
			.select({
				kind: unitSlugAddress.kind,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				slug: unitSlugAddress.slug,
				targetUnitId: unitSlugAddress.targetUnitId,
			})
			.from(unitSlugAddress)
			.where(
				and(
					eq(unitSlugAddress.kind, "canonical"),
					eq(unitSlugAddress.targetUnitId, namespace.id),
				),
			)
			.limit(1);
		assertFields(`slug namespace address ${namespace.slug}`, storedAddress, {
			kind: "canonical",
			scopeUnitId: null,
			slug: namespace.slug,
			targetUnitId: namespace.id,
		});
		if (created)
			await recordUnitRevision(tx, {
				unitId: namespace.id,
				actorProfileId: null,
				event: "create",
			});
	}
}

/** Installs an explicit reserved address; this never derives a slug from content. */
async function ensureBootstrapAddressedUnit(
	tx: DatabaseTransaction,
	input: {
		readonly id: string;
		readonly kind: "profile" | "realm" | "zone";
		readonly scopeUnitId: string;
		readonly slug: string;
	},
): Promise<boolean> {
	const [existing] = await tx
		.select({
			id: unit.id,
			kind: unit.kind,
			status: unit.status,
			visibility: unit.visibility,
			deletedAt: unit.deletedAt,
		})
		.from(unit)
		.where(eq(unit.id, input.id))
		.limit(1);
	if (existing) {
		assertFields(`${input.kind} Unit ${input.slug}`, existing, {
			id: input.id,
			kind: input.kind,
			status: "published",
			visibility: "public",
			deletedAt: null,
		});
	} else {
		const createdAt = bootstrapEpoch();
		await insertUnit(tx, {
			id: input.id,
			kind: input.kind,
			status: "published",
			visibility: "public",
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
			statusActor: { kind: "system" },
		});
	}

	const createdAt = bootstrapEpoch();
	const insertedAddress = await tx
		.insert(unitSlugAddress)
		.values({
			kind: "canonical",
			scopeUnitId: input.scopeUnitId,
			slug: input.slug,
			targetUnitId: input.id,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: unitSlugAddress.id });
	const [address] = await tx
		.select({
			kind: unitSlugAddress.kind,
			scopeUnitId: unitSlugAddress.scopeUnitId,
			slug: unitSlugAddress.slug,
			targetUnitId: unitSlugAddress.targetUnitId,
		})
		.from(unitSlugAddress)
		.where(
			and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, input.id)),
		)
		.limit(1);
	assertFields(`${input.kind} address ${input.slug}`, address, {
		kind: "canonical",
		scopeUnitId: input.scopeUnitId,
		slug: input.slug,
		targetUnitId: input.id,
	});
	return !existing || insertedAddress.length > 0;
}

async function ensureLocalization(
	tx: DatabaseTransaction,
	input: { readonly unitId: string; readonly title: string; readonly summary?: string },
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const result = await tx
		.insert(unitLocalization)
		.values({
			unitId: input.unitId,
			language: "zh",
			position: InitialFractionalPosition,
			title: input.title,
			summary: input.summary,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ unitId: unitLocalization.unitId });
	return result.length > 0;
}

async function ensureOfficialProfiles(
	tx: DatabaseTransaction,
	credentialMode: BootstrapCredentialMode,
): Promise<IssuedBootstrapCredential[]> {
	const createdAt = bootstrapEpoch();
	const issuedCredentials: IssuedBootstrapCredential[] = [];
	for (const value of OfficialProfileManifest) {
		await tx
			.insert(users)
			.values({
				id: value.authUserId,
				name: value.name,
				email: value.email,
				emailVerified: true,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing();
		const [storedUser] = await tx
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				emailVerified: users.emailVerified,
			})
			.from(users)
			.where(eq(users.id, value.authUserId))
			.limit(1);
		assertFields(`auth user ${value.key}`, storedUser, {
			id: value.authUserId,
			name: value.name,
			email: value.email,
			emailVerified: true,
		});

		const [storedAccount] = await tx
			.select({
				id: accounts.id,
				accountId: accounts.accountId,
				providerId: accounts.providerId,
				userId: accounts.userId,
			})
			.from(accounts)
			.where(
				and(
					eq(accounts.providerId, "credential"),
					eq(accounts.accountId, value.authUserId),
				),
			)
			.limit(1);
		if (storedAccount) {
			assertFields(`credential account ${value.key}`, storedAccount, {
				id: value.accountId,
				accountId: value.authUserId,
				providerId: "credential",
				userId: value.authUserId,
			});
		}

		if (!storedAccount || credentialMode === "overwrite") {
			const prepared = await prepareCredential();
			const action = storedAccount ? "overwritten" : "created";
			if (storedAccount) {
				const updated = await tx
					.update(accounts)
					.set({ password: prepared.passwordHash, updatedAt: new Date() })
					.where(eq(accounts.id, storedAccount.id))
					.returning({ id: accounts.id });
				if (updated.length !== 1 || updated[0]?.id !== storedAccount.id)
					throw new Error(
						`Bootstrap credential account ${value.key} was not overwritten`,
					);
			} else {
				await tx.insert(accounts).values({
					id: value.accountId,
					accountId: value.authUserId,
					providerId: "credential",
					userId: value.authUserId,
					password: prepared.passwordHash,
					createdAt,
					updatedAt: createdAt,
				});
			}
			issuedCredentials.push({
				action,
				name: value.name,
				email: value.email,
				password: prepared.password,
			});
		}

		let changed = await ensureBootstrapAddressedUnit(tx, {
			id: value.profileId,
			kind: "profile",
			scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
			slug: value.slug,
		});
		const insertedProfile = await tx
			.insert(profile)
			.values({
				id: value.profileId,
				authUserId: value.authUserId,
				joinedAt: createdAt,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ id: profile.id });
		changed ||= insertedProfile.length > 0;
		const [storedProfile] = await tx
			.select({ id: profile.id, authUserId: profile.authUserId })
			.from(profile)
			.where(eq(profile.id, value.profileId))
			.limit(1);
		assertFields(`Profile ${value.key}`, storedProfile, {
			id: value.profileId,
			authUserId: value.authUserId,
		});
		changed =
			(await ensureLocalization(tx, {
				unitId: value.profileId,
				title: value.name,
			})) || changed;
		const insertedPreference = await tx
			.insert(profilePreference)
			.values({ profileId: value.profileId, createdAt, updatedAt: createdAt })
			.onConflictDoNothing()
			.returning({ profileId: profilePreference.profileId });
		changed ||= insertedPreference.length > 0;
		if (changed)
			await recordUnitRevision(tx, {
				unitId: value.profileId,
				actorProfileId: value.profileId,
				event: "create",
				message: "Bootstrap official Profile",
			});
	}
	return issuedCredentials;
}

async function prepareCredential(): Promise<PreparedCredential> {
	const password = generateBootstrapPassword();
	return { password, passwordHash: await hashPassword(password) };
}

async function ensureOwnerBinding(
	tx: DatabaseTransaction,
	unitId: string,
	ownerProfileId: string,
): Promise<boolean> {
	const [owner] = await tx
		.select({
			id: unitAccessBinding.id,
			subjectKind: unitAccessBinding.subjectKind,
			profileId: unitAccessBinding.profileId,
			role: unitAccessBinding.role,
			scope: unitAccessBinding.scope,
			expiresAt: unitAccessBinding.expiresAt,
		})
		.from(unitAccessBinding)
		.where(
			and(
				eq(unitAccessBinding.unitId, unitId),
				eq(unitAccessBinding.role, "owner"),
				isNull(unitAccessBinding.revokedAt),
			),
		)
		.limit(1);
	if (owner) {
		if (
			owner.subjectKind !== "profile" ||
			owner.profileId !== ownerProfileId ||
			owner.scope.length !== 0 ||
			owner.expiresAt !== null
		)
			throw new Error(`Bootstrap Unit ${unitId} has an unexpected active owner`);
		return false;
	}
	await tx.insert(unitAccessBinding).values({
		unitId,
		subjectKind: "profile",
		profileId: ownerProfileId,
		role: "owner",
		scope: [],
		grantedByProfileId: ownerProfileId,
		createdAt: bootstrapEpoch(),
		updatedAt: bootstrapEpoch(),
	});
	return true;
}

async function ensureOfficialRealm(tx: DatabaseTransaction): Promise<void> {
	const value = OfficialRealmManifest;
	const createdAt = bootstrapEpoch();
	let changed = await ensureBootstrapAddressedUnit(tx, {
		id: value.id,
		kind: "realm",
		scopeUnitId: TopLevelSlugNamespaceUnitIds.realms,
		slug: value.slug,
	});
	const insertedRealm = await tx
		.insert(realm)
		.values({ id: value.id, joinPolicy: "open", createdAt, updatedAt: createdAt })
		.onConflictDoNothing()
		.returning({ id: realm.id });
	changed ||= insertedRealm.length > 0;
	changed =
		(await ensureLocalization(tx, {
			unitId: value.id,
			title: value.title,
			summary: value.summary,
		})) || changed;
	changed = (await ensureOwnerBinding(tx, value.id, value.ownerProfileId)) || changed;
	for (const member of value.members) {
		const insertedMember = await tx
			.insert(realmMember)
			.values({
				realmId: value.id,
				profileId: member.profileId,
				role: member.role,
				state: "active",
				joinedAt: createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ profileId: realmMember.profileId });
		changed ||= insertedMember.length > 0;
		const [stored] = await tx
			.select({ role: realmMember.role, state: realmMember.state })
			.from(realmMember)
			.where(
				and(eq(realmMember.realmId, value.id), eq(realmMember.profileId, member.profileId)),
			)
			.limit(1);
		assertFields(`Realm member ${member.profileId}`, stored, {
			role: member.role,
			state: "active",
		});
	}
	if (changed)
		await recordUnitRevision(tx, {
			unitId: value.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Realm",
		});
}

async function ensureOfficialZones(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	for (const value of OfficialZoneManifest) {
		let changed = await ensureBootstrapAddressedUnit(tx, {
			id: value.id,
			kind: "zone",
			scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
			slug: value.slug,
		});
		const insertedZone = await tx
			.insert(zone)
			.values({
				id: value.id,
				boundaryDocument: value.boundaryDocument,
				themeDocument: value.themeDocument,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ id: zone.id });
		changed ||= insertedZone.length > 0;
		const insertedDock = await tx
			.insert(unitDock)
			.values({
				unitId: value.id,
				surface: "main",
				document: value.mainDockDocument,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ unitId: unitDock.unitId });
		changed ||= insertedDock.length > 0;
		changed =
			(await ensureLocalization(tx, {
				unitId: value.id,
				title: value.title,
				summary: value.summary,
			})) || changed;
		changed = (await ensureOwnerBinding(tx, value.id, value.ownerProfileId)) || changed;
		const insertedRealmUnit = await tx
			.insert(realmUnit)
			.values({
				realmId: OfficialRealmManifest.id,
				unitId: value.id,
				status: "visible",
				postTargetingLocked: false,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ unitId: realmUnit.unitId });
		changed ||= insertedRealmUnit.length > 0;
		if (changed)
			await recordUnitRevision(tx, {
				unitId: value.id,
				actorProfileId: value.ownerProfileId,
				event: "create",
				message: "Bootstrap official Zone",
			});
	}
}

export async function isBootstrapReady(): Promise<boolean> {
	const [
		unitCount,
		addressCount,
		userCount,
		accountCount,
		profileCount,
		officialRealm,
		officialZones,
		officialZoneDocks,
	] = await Promise.all([
		database
			.select({ value: count() })
			.from(unit)
			.where(inArray(unit.id, [...BootstrapUnitIds])),
		database
			.select({ value: count() })
			.from(unitSlugAddress)
			.where(
				and(
					eq(unitSlugAddress.kind, "canonical"),
					inArray(unitSlugAddress.targetUnitId, [...BootstrapUnitIds]),
				),
			),
		database
			.select({ value: count() })
			.from(users)
			.where(inArray(users.id, BootstrapAuthUserIds)),
		database
			.select({ value: count() })
			.from(accounts)
			.where(inArray(accounts.id, BootstrapAccountIds)),
		database
			.select({ value: count() })
			.from(profile)
			.where(inArray(profile.id, OfficialProfileIdValues)),
		database
			.select({ id: realm.id })
			.from(realm)
			.where(eq(realm.id, OfficialRealmManifest.id))
			.limit(1),
		database
			.select({ id: zone.id })
			.from(zone)
			.where(
				inArray(
					zone.id,
					OfficialZoneManifest.map((value) => value.id),
				),
			),
		database
			.select({ unitId: unitDock.unitId })
			.from(unitDock)
			.where(
				and(
					eq(unitDock.surface, "main"),
					inArray(
						unitDock.unitId,
						OfficialZoneManifest.map((value) => value.id),
					),
				),
			),
	]);
	return (
		unitCount[0]?.value === BootstrapUnitIds.length &&
		addressCount[0]?.value === BootstrapUnitIds.length &&
		userCount[0]?.value === BootstrapAuthUserIds.length &&
		accountCount[0]?.value === BootstrapAccountIds.length &&
		profileCount[0]?.value === OfficialProfileIdValues.length &&
		Boolean(officialRealm[0]) &&
		officialZones.length === OfficialZoneManifest.length &&
		officialZoneDocks.length === OfficialZoneManifest.length
	);
}

export async function bootstrapDatabase(
	options: BootstrapOptions = FillBootstrapOptions,
): Promise<BootstrapResult> {
	assertBootstrapManifest();
	const issuedCredentials = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${BootstrapLockName}, 0))`,
		);
		await ensureSlugNamespaces(tx);
		const credentials = await ensureOfficialProfiles(tx, options.credentialMode);
		await ensureOfficialRealm(tx);
		await ensureOfficialZones(tx);
		return credentials;
	});
	return { issuedCredentials };
}

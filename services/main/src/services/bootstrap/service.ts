import { RealmUnitCreatePermissionValues } from "@rezics/access";
import { hashPassword } from "better-auth/crypto";
import type { AvatarReference } from "@rezics/avatar";
import { walkBlockTree } from "@rezics/block";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { database, type DatabaseTransaction } from "../database";
import {
	accounts,
	apiQuotaPolicy,
	apiQuotaPolicyRevision,
	profileFavoritesCollection,
	platformCapabilityGrant,
	contentStructure,
	contentStructureNode,
	imageAsset,
	imageObject,
	post,
	profile,
	profilePreference,
	realm,
	realmMember,
	realmRule,
	realmRuleRevision,
	realmUnit,
	unit,
	unitAccessGrant,
	unitOwnership,
	unitLocalization,
	unitDock,
	unitFollow,
	unitSlugAddress,
	users,
	zone,
	zonePage,
} from "../database/schema";
import {
	ApiQuotaPolicySchemaVersion,
	DefaultApiQuotaPolicies,
} from "../auth/api-quota/policy-schema";
import {
	createNavigationStructure,
	presentNavigationStructure,
	replaceNavigationStructure,
} from "../content-structure/navigation";
import { ContentStructureNotFound } from "../content-structure/errors";
import {
	createContentStructure,
	getContentStructureRevision,
	insertContentStructureNode,
} from "../content-structure/service";
import {
	createDockHistory,
	getDockRevisionId,
	lockDockHistory,
	updateDockHistory,
} from "../api/docks/history";
import type { ContentLanguage } from "../database/schema/contract-values";
import { compareFractionalPositions, fractionalPositionAt } from "../ordering/position";
import { recordAuditEvent } from "../audit";
import {
	ensureFavoritesInTransaction,
	ensureFixedFavoritesInTransaction,
} from "../collections/favorites";
import { lockPlatformAccess } from "../platform-access";
import { storage } from "../storage";
import { insertUnit, insertUnitIfMissing } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { recordInitialRealmUnitPublicationEvents } from "../units/realm-publication";
import { avatarReferenceToColumns } from "../units/localization";
import { replaceZonePageSlugAddress } from "../units/slug-address";
import { listZonePageUnits } from "../zones/pages";
import {
	ensureZoneDefaultExperienceInTransaction,
	type ProvisionZoneDefaultExperienceInput,
} from "../zones/default-experience";
import {
	getZoneSearchFeature,
	putZoneSearchFeatureInTransaction,
	type ZoneSearchFeatureProjection,
} from "../search/documents";
import { createDefaultSearchDocument } from "../search/templates";
import { type BootstrapCredentialMode, generateBootstrapPassword } from "./credentials";
import { ensureOfficialZoneFollows } from "./official-zone-follows";
import {
	assertBootstrapManifest,
	BootstrapAccountIds,
	BootstrapAuthUserIds,
	BootstrapEpochIso,
	BootstrapProfileIdValues,
	BootstrapProfileManifest,
	BootstrapRealmManifest,
	BootstrapPlatformAccessManifest,
	BootstrapUnitIds,
	OfficialProfileIds,
	OfficialRealmManifest,
	OfficialZoneAvatarAsset,
	OfficialZoneManifest,
	RezicsRuleRealmManifest,
	RezicsScoreRealmManifest,
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
	return isDeepStrictEqual(actual, expected);
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
	const [canonicalAddress] = await tx
		.select({
			id: unitSlugAddress.id,
			scopeUnitId: unitSlugAddress.scopeUnitId,
			slug: unitSlugAddress.slug,
		})
		.from(unitSlugAddress)
		.where(
			and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, input.id)),
		)
		.limit(1);
	let addressChanged = false;
	if (canonicalAddress) {
		if (
			canonicalAddress.scopeUnitId !== input.scopeUnitId ||
			canonicalAddress.slug !== input.slug
		) {
			await tx
				.update(unitSlugAddress)
				.set({ scopeUnitId: input.scopeUnitId, slug: input.slug, updatedAt: createdAt })
				.where(eq(unitSlugAddress.id, canonicalAddress.id));
			addressChanged = true;
		}
	} else {
		await tx.insert(unitSlugAddress).values({
			kind: "canonical",
			scopeUnitId: input.scopeUnitId,
			slug: input.slug,
			targetUnitId: input.id,
			createdAt,
			updatedAt: createdAt,
		});
		addressChanged = true;
	}
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
	return !existing || addressChanged;
}

async function ensureLocalization(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly language: ContentLanguage;
		readonly position: string;
		readonly title: string;
		readonly summary?: string;
		readonly avatar?: AvatarReference | null;
		readonly content?: unknown;
		readonly contentStatus?: "published" | null;
	},
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const desired = {
		summary: input.summary ?? null,
		...avatarReferenceToColumns(input.avatar ?? null),
		content: input.content ?? null,
		contentStatus: input.contentStatus ?? null,
	};
	const [stored] = await tx
		.select({
			position: unitLocalization.position,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			avatarType: unitLocalization.avatarType,
			avatarAssetId: unitLocalization.avatarAssetId,
			avatarEmoji: unitLocalization.avatarEmoji,
			avatarIconPrefix: unitLocalization.avatarIconPrefix,
			avatarIconName: unitLocalization.avatarIconName,
			content: unitLocalization.content,
			contentStatus: unitLocalization.contentStatus,
		})
		.from(unitLocalization)
		.where(
			and(
				eq(unitLocalization.unitId, input.unitId),
				eq(unitLocalization.language, input.language),
			),
		)
		.limit(1);
	if (
		stored?.position === input.position &&
		stored.title === input.title &&
		stored.summary === desired.summary &&
		stored.avatarType === desired.avatarType &&
		stored.avatarAssetId === desired.avatarAssetId &&
		stored.avatarEmoji === desired.avatarEmoji &&
		stored.avatarIconPrefix === desired.avatarIconPrefix &&
		stored.avatarIconName === desired.avatarIconName &&
		valuesEqual(stored.content, desired.content) &&
		stored.contentStatus === desired.contentStatus
	)
		return false;
	if (stored) {
		await tx
			.update(unitLocalization)
			.set({
				position: input.position,
				title: input.title,
				...desired,
				updatedAt: createdAt,
			})
			.where(
				and(
					eq(unitLocalization.unitId, input.unitId),
					eq(unitLocalization.language, input.language),
				),
			);
		return true;
	}
	await tx.insert(unitLocalization).values({
		unitId: input.unitId,
		language: input.language,
		position: input.position,
		title: input.title,
		...desired,
		createdAt,
		updatedAt: createdAt,
	});
	return true;
}

async function ensureBootstrapProfiles(
	tx: DatabaseTransaction,
	credentialMode: BootstrapCredentialMode,
): Promise<IssuedBootstrapCredential[]> {
	const createdAt = bootstrapEpoch();
	const issuedCredentials: IssuedBootstrapCredential[] = [];
	for (const value of BootstrapProfileManifest) {
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
		for (const [index, localization] of value.localizations.entries()) {
			changed =
				(await ensureLocalization(tx, {
					unitId: value.profileId,
					position: fractionalPositionAt(index),
					...localization,
				})) || changed;
		}
		const insertedPreference = await tx
			.insert(profilePreference)
			.values({ profileId: value.profileId, createdAt, updatedAt: createdAt })
			.onConflictDoNothing()
			.returning({ profileId: profilePreference.profileId });
		changed ||= insertedPreference.length > 0;
		changed = (await ensureOwnership(tx, value.profileId, value.profileId)) || changed;
		if (changed)
			await recordUnitRevision(tx, {
				unitId: value.profileId,
				actorProfileId: value.profileId,
				event: "create",
				message: "Bootstrap Profile",
			});
	}
	return issuedCredentials;
}

async function ensureProfileFavorites(tx: DatabaseTransaction): Promise<void> {
	const profiles = await tx.select({ id: profile.id }).from(profile);
	const bootstrapProfiles = new Map<string, (typeof BootstrapProfileManifest)[number]>(
		BootstrapProfileManifest.map((value) => [value.profileId, value] as const),
	);
	for (const targetProfile of profiles) {
		const bootstrapProfile = bootstrapProfiles.get(targetProfile.id);
		if (bootstrapProfile) {
			await ensureFixedFavoritesInTransaction(tx, {
				profileId: bootstrapProfile.profileId,
				collectionId: bootstrapProfile.favoritesCollectionId,
				createdAt: bootstrapEpoch(),
			});
		} else {
			await ensureFavoritesInTransaction(tx, targetProfile.id);
		}
	}
}

async function ensureBootstrapPlatformAccess(tx: DatabaseTransaction): Promise<void> {
	await lockPlatformAccess(tx);
	const createdAt = bootstrapEpoch();
	for (const access of BootstrapPlatformAccessManifest)
		for (const capability of access.capabilities) {
			const [current] = await tx
				.select({
					id: platformCapabilityGrant.id,
					expiresAt: platformCapabilityGrant.expiresAt,
				})
				.from(platformCapabilityGrant)
				.where(
					and(
						eq(platformCapabilityGrant.profileId, access.profileId),
						eq(platformCapabilityGrant.capability, capability),
						isNull(platformCapabilityGrant.revokedAt),
					),
				)
				.limit(1);
			if (current?.expiresAt === null) continue;
			if (current)
				await tx
					.update(platformCapabilityGrant)
					.set({
						revokedAt: createdAt,
						revokedByProfileId: access.grantedByProfileId,
						updatedAt: createdAt,
					})
					.where(eq(platformCapabilityGrant.id, current.id));
			const [created] = await tx
				.insert(platformCapabilityGrant)
				.values({
					profileId: access.profileId,
					capability,
					grantedByProfileId: access.grantedByProfileId,
					createdAt,
					updatedAt: createdAt,
				})
				.returning({ id: platformCapabilityGrant.id });
			await recordAuditEvent(tx, {
				category: "system_event",
				outcome: "succeeded",
				actor: {
					kind: "profile",
					profileId: access.grantedByProfileId,
					credentialKind: "bootstrap",
				},
				authority: { kind: "platform" },
				action: "platform.access.bootstrap",
				target: {
					kind: "profile",
					id: access.profileId,
				},
				details: {
					capability,
					grantId: created?.id,
					replacedGrantId: current?.id,
					source: "bootstrap",
				},
				createdAt,
			});
		}
}

async function prepareCredential(): Promise<PreparedCredential> {
	const password = generateBootstrapPassword();
	return { password, passwordHash: await hashPassword(password) };
}

async function ensureOwnership(
	tx: DatabaseTransaction,
	unitId: string,
	ownerProfileId: string,
): Promise<boolean> {
	const [owner] = await tx
		.select({
			id: unitOwnership.id,
			profileId: unitOwnership.profileId,
		})
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, unitId), isNull(unitOwnership.revokedAt)))
		.limit(1);
	if (owner) {
		if (owner.profileId !== ownerProfileId)
			throw new Error(`Bootstrap Unit ${unitId} has an unexpected active owner`);
		return false;
	}
	await tx.insert(unitOwnership).values({
		unitId,
		profileId: ownerProfileId,
		assignedByProfileId: ownerProfileId,
		createdAt: bootstrapEpoch(),
		updatedAt: bootstrapEpoch(),
	});
	return true;
}

async function ensureBootstrapRealm(
	tx: DatabaseTransaction,
	value: (typeof BootstrapRealmManifest)[number],
): Promise<void> {
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
	const [storedTaxonomy] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, value.id),
				eq(contentStructure.kind, "realm.taxonomy"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!storedTaxonomy) {
		await tx.insert(contentStructure).values({
			ownerUnitId: value.id,
			kind: "realm.taxonomy",
			createdAt,
			updatedAt: createdAt,
		});
		changed = true;
	}
	for (const [index, localization] of value.localizations.entries()) {
		changed =
			(await ensureLocalization(tx, {
				unitId: value.id,
				position: fractionalPositionAt(index),
				...localization,
			})) || changed;
	}
	changed = (await ensureOwnership(tx, value.id, value.ownerProfileId)) || changed;
	for (const permission of [
		"unit.read",
		"realm.contribute",
		...RealmUnitCreatePermissionValues,
	] as const) {
		const [stored] = await tx
			.select({ id: unitAccessGrant.id })
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, value.id),
					eq(unitAccessGrant.subjectKind, "realm"),
					eq(unitAccessGrant.realmId, value.id),
					eq(unitAccessGrant.realmRelation, "member"),
					eq(unitAccessGrant.permission, permission),
					isNull(unitAccessGrant.revokedAt),
				),
			)
			.limit(1);
		if (!stored) {
			await tx.insert(unitAccessGrant).values({
				unitId: value.id,
				subjectKind: "realm",
				realmId: value.id,
				realmRelation: "member",
				permission,
				scope: [],
				grantedByProfileId: value.ownerProfileId,
				createdAt,
				updatedAt: createdAt,
			});
			changed = true;
		}
	}
	for (const permission of value.authenticatedContributions
		? RealmUnitCreatePermissionValues
		: []) {
		const [stored] = await tx
			.select({ id: unitAccessGrant.id })
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, value.id),
					eq(unitAccessGrant.subjectKind, "authenticated"),
					eq(unitAccessGrant.permission, permission),
					isNull(unitAccessGrant.revokedAt),
				),
			)
			.limit(1);
		if (!stored) {
			await tx.insert(unitAccessGrant).values({
				unitId: value.id,
				subjectKind: "authenticated",
				permission,
				scope: [],
				grantedByProfileId: value.ownerProfileId,
				createdAt,
				updatedAt: createdAt,
			});
			changed = true;
		}
	}
	for (const access of value.access)
		for (const permission of access.permissions) {
			const [stored] = await tx
				.select({ id: unitAccessGrant.id })
				.from(unitAccessGrant)
				.where(
					and(
						eq(unitAccessGrant.unitId, value.id),
						eq(unitAccessGrant.subjectKind, "profile"),
						eq(unitAccessGrant.profileId, access.profileId),
						eq(unitAccessGrant.permission, permission),
						isNull(unitAccessGrant.revokedAt),
					),
				)
				.limit(1);
			if (!stored) {
				await tx.insert(unitAccessGrant).values({
					unitId: value.id,
					subjectKind: "profile",
					profileId: access.profileId,
					permission,
					scope: [],
					grantedByProfileId: value.ownerProfileId,
					createdAt,
					updatedAt: createdAt,
				});
				changed = true;
			}
		}
	for (const memberProfileId of value.members) {
		const insertedMember = await tx
			.insert(realmMember)
			.values({
				realmId: value.id,
				profileId: memberProfileId,
				state: "active",
				joinedAt: createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ profileId: realmMember.profileId });
		changed ||= insertedMember.length > 0;
		const [stored] = await tx
			.select({ state: realmMember.state })
			.from(realmMember)
			.where(
				and(eq(realmMember.realmId, value.id), eq(realmMember.profileId, memberProfileId)),
			)
			.limit(1);
		assertFields(`Realm member ${memberProfileId}`, stored, {
			state: "active",
		});
	}
	if ("rules" in value) changed = (await ensureBootstrapRealmRules(tx, value)) || changed;
	if (changed)
		await recordUnitRevision(tx, {
			unitId: value.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Realm",
		});
}

async function ensureBootstrapRealmRules(
	tx: DatabaseTransaction,
	value: typeof RezicsRuleRealmManifest,
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const definition = value.rules;
	let changed = false;
	const insertedRevision = await tx
		.insert(realmRuleRevision)
		.values({
			id: definition.revisionId,
			realmId: value.id,
			version: definition.version,
			acknowledgementMode: definition.acknowledgementMode,
			requireOnJoin: definition.requireOnJoin,
			requireOnPost: definition.requireOnPost,
			createdByProfileId: value.ownerProfileId,
			publishedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: realmRuleRevision.id });
	changed ||= insertedRevision.length > 0;
	const [storedRevision] = await tx
		.select({
			id: realmRuleRevision.id,
			realmId: realmRuleRevision.realmId,
			version: realmRuleRevision.version,
			acknowledgementMode: realmRuleRevision.acknowledgementMode,
			requireOnJoin: realmRuleRevision.requireOnJoin,
			requireOnPost: realmRuleRevision.requireOnPost,
			createdByProfileId: realmRuleRevision.createdByProfileId,
		})
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.id, definition.revisionId))
		.limit(1);
	assertFields("REZICS Rule revision", storedRevision, {
		id: definition.revisionId,
		realmId: value.id,
		version: definition.version,
		acknowledgementMode: definition.acknowledgementMode,
		requireOnJoin: definition.requireOnJoin,
		requireOnPost: definition.requireOnPost,
		createdByProfileId: value.ownerProfileId,
	});

	for (const [position, ruleDefinition] of definition.items.entries()) {
		const createdRuleUnit = await insertUnitIfMissing(tx, {
			id: ruleDefinition.id,
			kind: "realm_rule",
			status: "published",
			visibility: "unlisted",
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
			statusActor: { kind: "system" },
		});
		let ruleChanged = createdRuleUnit !== null;
		for (const [localizationIndex, localization] of ruleDefinition.localizations.entries())
			ruleChanged =
				(await ensureLocalization(tx, {
					unitId: ruleDefinition.id,
					position: fractionalPositionAt(localizationIndex),
					contentStatus: "published",
					...localization,
				})) || ruleChanged;
		ruleChanged =
			(await ensureOwnership(tx, ruleDefinition.id, value.ownerProfileId)) || ruleChanged;
		const insertedRule = await tx
			.insert(realmRule)
			.values({
				id: ruleDefinition.id,
				revisionId: definition.revisionId,
				position,
				createdAt,
			})
			.onConflictDoNothing()
			.returning({ id: realmRule.id });
		ruleChanged ||= insertedRule.length > 0;
		const [storedRule] = await tx
			.select({
				id: realmRule.id,
				revisionId: realmRule.revisionId,
				position: realmRule.position,
			})
			.from(realmRule)
			.where(eq(realmRule.id, ruleDefinition.id))
			.limit(1);
		assertFields(`REZICS Rule item ${position + 1}`, storedRule, {
			id: ruleDefinition.id,
			revisionId: definition.revisionId,
			position,
		});
		if (ruleChanged)
			await recordUnitRevision(tx, {
				unitId: ruleDefinition.id,
				actorProfileId: value.ownerProfileId,
				event: createdRuleUnit ? "create" : "update",
				message: "Bootstrap REZICS Rule item",
			});
		changed ||= ruleChanged;
	}
	return changed;
}

async function ensureScoreRealmProfileDefaults(tx: DatabaseTransaction): Promise<void> {
	const profiles = await tx.select({ id: profile.id }).from(profile);
	if (profiles.length) {
		await tx
			.insert(realmMember)
			.values(
				profiles.map(({ id }) => ({
					realmId: RezicsScoreRealmManifest.id,
					profileId: id,
					state: "active" as const,
				})),
			)
			.onConflictDoNothing();
		await tx
			.insert(profilePreference)
			.values(
				profiles.map(({ id }) => ({
					profileId: id,
					defaultScoreRealmId: RezicsScoreRealmManifest.id,
				})),
			)
			.onConflictDoNothing();
	}
	await tx
		.update(profilePreference)
		.set({ defaultScoreRealmId: RezicsScoreRealmManifest.id })
		.where(isNull(profilePreference.defaultScoreRealmId));
}

async function ensureOfficialZoneAvatar(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	const bytes = await readFile(fileURLToPath(import.meta.resolve("@rezics/brand/avatar.png")));
	const tracking = {
		image_asset_id: OfficialZoneAvatarAsset.id,
		image_object_id: OfficialZoneAvatarAsset.objectId,
		uploader_profile_id: OfficialProfileIds.editorial,
	};
	await storage.put({
		Key: OfficialZoneAvatarAsset.storageKey,
		Body: bytes,
		ContentType: "image/png",
		ContentLength: bytes.byteLength,
		Metadata: tracking,
	});
	await tx
		.insert(imageAsset)
		.values({
			id: OfficialZoneAvatarAsset.id,
			uploaderProfileId: OfficialProfileIds.editorial,
			ownerProfileId: OfficialProfileIds.editorial,
			status: "ready",
			access: "public",
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoUpdate({
			target: imageAsset.id,
			set: {
				uploaderProfileId: OfficialProfileIds.editorial,
				ownerProfileId: OfficialProfileIds.editorial,
				status: "ready",
				access: "public",
				deletedAt: null,
				updatedAt: createdAt,
			},
		});
	await tx
		.insert(imageObject)
		.values({
			id: OfficialZoneAvatarAsset.objectId,
			assetId: OfficialZoneAvatarAsset.id,
			storageKey: OfficialZoneAvatarAsset.storageKey,
			mediaType: "image/png",
			byteSize: bytes.byteLength,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoUpdate({
			target: imageObject.id,
			set: {
				assetId: OfficialZoneAvatarAsset.id,
				storageKey: OfficialZoneAvatarAsset.storageKey,
				mediaType: "image/png",
				byteSize: bytes.byteLength,
				updatedAt: createdAt,
			},
		});
}

async function ensureOfficialWikiPost(
	tx: DatabaseTransaction,
	value: (typeof OfficialZoneManifest)[number],
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const created = await insertUnitIfMissing(tx, {
		id: value.wikiPost.id,
		kind: "post",
		status: "published",
		visibility: "public",
		publishedAt: createdAt,
		createdAt,
		updatedAt: createdAt,
		statusActor: { kind: "system" },
	});
	const insertedPost = await tx
		.insert(post)
		.values({
			id: value.wikiPost.id,
			kind: "wiki",
			subjectUnitId: value.id,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: post.id });
	let changed = Boolean(created) || insertedPost.length > 0;
	for (const [index, localization] of value.wikiPost.localizations.entries()) {
		changed =
			(await ensureLocalization(tx, {
				unitId: value.wikiPost.id,
				language: localization.language,
				position: fractionalPositionAt(index),
				title: localization.title,
				content: localization.body,
				contentStatus: "published",
			})) || changed;
	}
	changed = (await ensureOwnership(tx, value.wikiPost.id, value.ownerProfileId)) || changed;
	const insertedRealmUnit = await tx
		.insert(realmUnit)
		.values({
			realmId: OfficialRealmManifest.id,
			unitId: value.wikiPost.id,
			status: "visible",
			postTargetingLocked: false,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ realmId: realmUnit.realmId, unitId: realmUnit.unitId });
	await recordInitialRealmUnitPublicationEvents(tx, {
		relations: insertedRealmUnit.map((relation) => ({ ...relation, createdAt })),
		actorProfileId: value.ownerProfileId,
	});
	if (changed)
		await recordUnitRevision(tx, {
			unitId: value.wikiPost.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Zone Wiki Post",
		});
	return changed;
}

async function ensureOfficialZonePage(
	tx: DatabaseTransaction,
	value: (typeof OfficialZoneManifest)[number],
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const created = await insertUnitIfMissing(tx, {
		id: value.homePage.id,
		kind: "zone_page",
		status: "published",
		visibility: "public",
		publishedAt: createdAt,
		createdAt,
		updatedAt: createdAt,
		statusActor: { kind: "system" },
	});
	let changed = Boolean(created);
	const [pagePost] = await tx
		.insert(post)
		.values({
			id: value.homePage.id,
			subjectUnitId: value.id,
			kind: "page",
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: post.id });
	changed = Boolean(pagePost) || changed;
	const [pageOwnership] = await tx
		.insert(zonePage)
		.values({
			id: value.homePage.id,
			zoneId: value.id,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: zonePage.id });
	changed = Boolean(pageOwnership) || changed;
	for (const [index, localization] of value.wikiPost.localizations.entries()) {
		changed =
			(await ensureLocalization(tx, {
				unitId: value.homePage.id,
				language: localization.language,
				position: fractionalPositionAt(index),
				title: localization.title,
				content: value.homePage.document,
				contentStatus: "published",
			})) || changed;
	}
	changed = (await ensureOwnership(tx, value.homePage.id, value.ownerProfileId)) || changed;
	const [address] = await tx
		.select({ slug: unitSlugAddress.slug, scopeUnitId: unitSlugAddress.scopeUnitId })
		.from(unitSlugAddress)
		.where(
			and(
				eq(unitSlugAddress.targetUnitId, value.homePage.id),
				eq(unitSlugAddress.kind, "canonical"),
			),
		)
		.limit(1);
	if (address?.scopeUnitId !== value.id || address.slug !== value.homePage.slug) {
		await replaceZonePageSlugAddress(tx, {
			zoneId: value.id,
			pageUnitId: value.homePage.id,
			slug: value.homePage.slug,
		});
		changed = true;
	}

	const [storedStructure] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, value.id),
				eq(contentStructure.kind, "page-structure"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	let structureId = storedStructure?.id;
	let revisionId: string;
	if (structureId) {
		if (structureId !== value.homePage.structureId)
			throw new Error(`Bootstrap Zone ${value.id} has an unexpected pages structure`);
		const currentRevisionId = await getContentStructureRevision(tx, value.id, structureId);
		if (!currentRevisionId) throw new Error("Official Zone page structure has no revision");
		revisionId = currentRevisionId;
	} else {
		const createdStructure = await createContentStructure(tx, {
			structureId: value.homePage.structureId,
			ownerUnitId: value.id,
			kind: "page-structure",
			actorProfileId: value.ownerProfileId,
			message: "Bootstrap official Zone page structure",
		});
		structureId = createdStructure.structure.id;
		revisionId = createdStructure.revisionId;
		changed = true;
	}
	const [storedNode] = await tx
		.select({ id: contentStructureNode.id })
		.from(contentStructureNode)
		.where(
			and(
				eq(contentStructureNode.structureId, structureId),
				eq(contentStructureNode.contentUnitId, value.homePage.id),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.limit(1);
	if (!storedNode) {
		await insertContentStructureNode(tx, {
			ownerUnitId: value.id,
			structureId,
			baseRevisionId: revisionId,
			actorProfileId: value.ownerProfileId,
			contentUnitId: value.homePage.id,
			parentId: null,
			position: fractionalPositionAt(0),
			message: "Bootstrap official Zone home page",
		});
		changed = true;
	}
	if (changed)
		await recordUnitRevision(tx, {
			unitId: value.homePage.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Zone Page Unit",
		});
	return changed;
}

async function ensureOfficialZoneSearchFeature(
	tx: DatabaseTransaction,
	value: (typeof OfficialZoneManifest)[number],
): Promise<boolean> {
	const expectedDocument = createDefaultSearchDocument(value.searchTemplate);
	const current = await getZoneSearchFeature(tx, value.id);
	if (current?.enabled && valuesEqual(current.document, expectedDocument)) return false;
	await putZoneSearchFeatureInTransaction(tx, {
		zoneId: value.id,
		enabled: true,
		document: expectedDocument,
		...(current ? { baseRevisionId: current.latestRevisionId } : {}),
		actorProfileId: value.ownerProfileId,
		message: current
			? "Reconcile official Zone Search Feature"
			: "Bootstrap official Zone Search Feature",
	});
	return true;
}

async function ensureOfficialZones(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	for (const value of OfficialZoneManifest) {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${value.id}`}::text, 0))`,
		);
		let changed = await ensureBootstrapAddressedUnit(tx, {
			id: value.id,
			kind: "zone",
			scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
			slug: value.slug,
		});
		const [storedZone] = await tx
			.select({
				boundaryDocument: zone.boundaryDocument,
				themeDocument: zone.themeDocument,
			})
			.from(zone)
			.where(eq(zone.id, value.id))
			.limit(1);
		if (storedZone) {
			if (
				!valuesEqual(storedZone.boundaryDocument, value.boundaryDocument) ||
				!valuesEqual(storedZone.themeDocument, value.themeDocument)
			) {
				await tx
					.update(zone)
					.set({
						boundaryDocument: value.boundaryDocument,
						themeDocument: value.themeDocument,
						updatedAt: createdAt,
					})
					.where(eq(zone.id, value.id));
				changed = true;
			}
		} else {
			await tx.insert(zone).values({
				id: value.id,
				boundaryDocument: value.boundaryDocument,
				themeDocument: value.themeDocument,
				createdAt,
				updatedAt: createdAt,
			});
			changed = true;
		}
		changed = (await ensureOfficialZoneSearchFeature(tx, value)) || changed;
		changed = (await ensureOfficialWikiPost(tx, value)) || changed;
		changed = (await ensureOfficialZonePage(tx, value)) || changed;
		const [storedNavigation] = await tx
			.select({ id: contentStructure.id })
			.from(contentStructure)
			.where(
				and(
					eq(contentStructure.id, value.navigation.id),
					eq(contentStructure.ownerUnitId, value.id),
					eq(contentStructure.kind, "zone.navigation"),
					isNull(contentStructure.deletedAt),
				),
			)
			.limit(1);
		if (storedNavigation) {
			const current = await presentNavigationStructure(tx, {
				ownerUnitId: value.id,
				structureId: value.navigation.id,
				kind: "zone.navigation",
			});
			if (!valuesEqual(current.document, value.navigation.document)) {
				const revisionId = await getContentStructureRevision(
					tx,
					value.id,
					value.navigation.id,
				);
				if (!revisionId)
					throw new Error("Official Zone navigation has no component revision");
				await replaceNavigationStructure(tx, {
					ownerUnitId: value.id,
					structureId: value.navigation.id,
					kind: "zone.navigation",
					document: value.navigation.document,
					actorProfileId: value.ownerProfileId,
					baseRevisionId: revisionId,
				});
				changed = true;
			}
		} else {
			await createNavigationStructure(tx, {
				ownerUnitId: value.id,
				structureId: value.navigation.id,
				kind: "zone.navigation",
				document: value.navigation.document,
				actorProfileId: value.ownerProfileId,
			});
			changed = true;
		}
		const [storedDock] = await tx
			.select()
			.from(unitDock)
			.where(
				and(
					eq(unitDock.unitId, value.id),
					eq(unitDock.kind, "main"),
					isNull(unitDock.deletedAt),
				),
			)
			.limit(1);
		if (storedDock) {
			if (!valuesEqual(storedDock.document, value.mainDockDocument)) {
				await lockDockHistory(tx, storedDock.id);
				const [updatedDock] = await tx
					.update(unitDock)
					.set({ document: value.mainDockDocument, updatedAt: createdAt })
					.where(eq(unitDock.id, storedDock.id))
					.returning();
				if (!updatedDock) throw new Error("Official Zone Dock update returned no row");
				const revisionId = await getDockRevisionId(tx, storedDock.id);
				if (revisionId)
					await updateDockHistory(tx, {
						dock: updatedDock,
						baseRevisionId: revisionId,
						actorProfileId: value.ownerProfileId,
					});
				else
					await createDockHistory(tx, {
						dock: updatedDock,
						actorProfileId: value.ownerProfileId,
					});
				changed = true;
			} else if (!(await getDockRevisionId(tx, storedDock.id)))
				await createDockHistory(tx, {
					dock: storedDock,
					actorProfileId: value.ownerProfileId,
				});
		} else {
			const [createdDock] = await tx
				.insert(unitDock)
				.values({
					unitId: value.id,
					kind: "main",
					document: value.mainDockDocument,
					createdAt,
					updatedAt: createdAt,
				})
				.returning();
			if (!createdDock) throw new Error("Official Zone Dock insertion returned no row");
			await createDockHistory(tx, {
				dock: createdDock,
				actorProfileId: value.ownerProfileId,
			});
			changed = true;
		}
		for (const [index, localization] of value.localizations.entries()) {
			changed =
				(await ensureLocalization(tx, {
					unitId: value.id,
					position: fractionalPositionAt(index),
					avatar: value.avatar,
					...localization,
				})) || changed;
		}
		changed = (await ensureOwnership(tx, value.id, value.ownerProfileId)) || changed;
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
			.returning({ realmId: realmUnit.realmId, unitId: realmUnit.unitId });
		await recordInitialRealmUnitPublicationEvents(tx, {
			relations: insertedRealmUnit.map((relation) => ({ ...relation, createdAt })),
			actorProfileId: value.ownerProfileId,
		});
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

async function getZoneDefaultExperienceInput(
	tx: DatabaseTransaction,
	zoneId: string,
): Promise<ProvisionZoneDefaultExperienceInput> {
	const [owner] = await tx
		.select({ profileId: unitOwnership.profileId })
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, zoneId), isNull(unitOwnership.revokedAt)))
		.limit(1);
	const [localization] = await tx
		.select({
			language: unitLocalization.language,
			title: unitLocalization.title,
		})
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, zoneId))
		.orderBy(unitLocalization.position, unitLocalization.language)
		.limit(1);
	if (!owner?.profileId || !localization?.title)
		throw new Error(`Zone ${zoneId} cannot be provisioned without an owner and localization`);
	return {
		zoneId,
		actorProfileId: owner.profileId,
		language: localization.language,
		title: localization.title,
		searchTemplate:
			OfficialZoneManifest.find((candidate) => candidate.id === zoneId)?.searchTemplate ??
			"global",
	};
}

async function ensureAllZoneExperiences(tx: DatabaseTransaction): Promise<void> {
	const zones = await tx
		.select({ id: zone.id })
		.from(zone)
		.innerJoin(unit, eq(unit.id, zone.id))
		.where(and(eq(unit.kind, "zone"), isNull(unit.deletedAt)));
	for (const { id } of zones)
		await ensureZoneDefaultExperienceInTransaction(
			tx,
			await getZoneDefaultExperienceInput(tx, id),
		);
}

async function areAllZoneExperiencesReady(): Promise<boolean> {
	return database.transaction(async (tx) => {
		const zones = await tx
			.select({ id: zone.id })
			.from(zone)
			.innerJoin(unit, eq(unit.id, zone.id))
			.where(and(eq(unit.kind, "zone"), isNull(unit.deletedAt)));
		for (const { id } of zones) {
			const feature = await getZoneSearchFeature(tx, id);
			if (!feature?.enabled) return false;
			const pages = await listZonePageUnits(tx, id);
			if (
				!pages.some((page) => {
					if (!page.placement) return false;
					let found = false;
					walkBlockTree(page.document, (block) => {
						if (block._type === "feed") found = true;
					});
					return found;
				})
			)
				return false;
		}
		return true;
	});
}

async function ensureDefaultApiQuotaPolicies(tx: DatabaseTransaction): Promise<void> {
	for (const definition of Object.values(DefaultApiQuotaPolicies)) {
		await tx
			.insert(apiQuotaPolicy)
			.values({
				key: definition.key,
				class: definition.class,
				currentRevision: 1,
				enabled: true,
				createdAt: bootstrapEpoch(),
				updatedAt: bootstrapEpoch(),
			})
			.onConflictDoNothing({ target: apiQuotaPolicy.key });
		const [policy] = await tx
			.select({ id: apiQuotaPolicy.id })
			.from(apiQuotaPolicy)
			.where(eq(apiQuotaPolicy.key, definition.key))
			.limit(1);
		if (!policy) throw new Error(`Failed to bootstrap API quota policy: ${definition.key}`);
		await tx
			.insert(apiQuotaPolicyRevision)
			.values({
				policyId: policy.id,
				revision: 1,
				schemaVersion: definition.schemaVersion,
				configuration: definition.configuration,
				changeReason: "Bootstrap default",
				createdByProfileId: null,
				createdAt: bootstrapEpoch(),
			})
			.onConflictDoNothing({
				target: [apiQuotaPolicyRevision.policyId, apiQuotaPolicyRevision.revision],
			});
	}
}

async function isBootstrapReady(): Promise<boolean> {
	const expectedAddresses = [
		...SlugNamespaceManifest.map((namespace) => ({
			targetUnitId: namespace.id,
			scopeUnitId: null,
			slug: namespace.slug,
		})),
		...BootstrapProfileManifest.map((bootstrapProfile) => ({
			targetUnitId: bootstrapProfile.profileId,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
			slug: bootstrapProfile.slug,
		})),
		...BootstrapRealmManifest.map((bootstrapRealm) => ({
			targetUnitId: bootstrapRealm.id,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.realms,
			slug: bootstrapRealm.slug,
		})),
		...OfficialZoneManifest.map((officialZone) => ({
			targetUnitId: officialZone.id,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
			slug: officialZone.slug,
		})),
		...OfficialZoneManifest.map((officialZone) => ({
			targetUnitId: officialZone.homePage.id,
			scopeUnitId: officialZone.id,
			slug: officialZone.homePage.slug,
		})),
	];
	const expectedLocalizations = [
		...BootstrapProfileManifest.flatMap((bootstrapProfile) =>
			bootstrapProfile.localizations.map((localization, index) => ({
				unitId: bootstrapProfile.profileId,
				position: fractionalPositionAt(index),
				summary: null,
				...localization,
			})),
		),
		...BootstrapRealmManifest.flatMap((bootstrapRealm) =>
			bootstrapRealm.localizations.map((localization, index) => ({
				unitId: bootstrapRealm.id,
				position: fractionalPositionAt(index),
				...localization,
			})),
		),
		...RezicsRuleRealmManifest.rules.items.flatMap((rule) =>
			rule.localizations.map((localization, index) => ({
				unitId: rule.id,
				position: fractionalPositionAt(index),
				summary: null,
				avatarType: null,
				avatarAssetId: null,
				avatarEmoji: null,
				avatarIconPrefix: null,
				avatarIconName: null,
				contentStatus: "published" as const,
				...localization,
			})),
		),
		...OfficialZoneManifest.flatMap((officialZone) =>
			officialZone.localizations.map((localization, index) => ({
				unitId: officialZone.id,
				position: fractionalPositionAt(index),
				...avatarReferenceToColumns(officialZone.avatar),
				content: null,
				...localization,
			})),
		),
		...OfficialZoneManifest.flatMap((officialZone) =>
			officialZone.wikiPost.localizations.map((localization, index) => ({
				unitId: officialZone.wikiPost.id,
				position: fractionalPositionAt(index),
				summary: null,
				avatarType: null,
				avatarAssetId: null,
				avatarEmoji: null,
				avatarIconPrefix: null,
				avatarIconName: null,
				content: localization.body,
				contentStatus: "published" as const,
				language: localization.language,
				title: localization.title,
			})),
		),
		...OfficialZoneManifest.flatMap((officialZone) =>
			officialZone.wikiPost.localizations.map((localization, index) => ({
				unitId: officialZone.homePage.id,
				position: fractionalPositionAt(index),
				summary: null,
				avatarType: null,
				avatarAssetId: null,
				avatarEmoji: null,
				avatarIconPrefix: null,
				avatarIconName: null,
				content: officialZone.homePage.document,
				contentStatus: "published" as const,
				language: localization.language,
				title: localization.title,
			})),
		),
	];
	const [
		unitCount,
		addresses,
		bootstrapUsers,
		accountCount,
		profileCount,
		bootstrapProfileOwners,
		bootstrapPlatformAccess,
		officialRealms,
		bootstrapRuleRevision,
		bootstrapRules,
		officialZones,
		officialZoneSearchFeatures,
		officialZoneDocks,
		officialWikiPosts,
		officialZonePages,
		officialZoneNavigations,
		officialZoneAvatar,
		allProfiles,
		profileFavorites,
		profileScoreMemberships,
		profilePreferences,
		profileFollows,
		localizations,
		defaultApiQuotaPolicies,
		allZoneExperiencesReady,
	] = await Promise.all([
		database
			.select({ value: count() })
			.from(unit)
			.where(inArray(unit.id, [...BootstrapUnitIds])),
		database
			.select({
				targetUnitId: unitSlugAddress.targetUnitId,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				slug: unitSlugAddress.slug,
			})
			.from(unitSlugAddress)
			.where(
				and(
					eq(unitSlugAddress.kind, "canonical"),
					inArray(unitSlugAddress.targetUnitId, [...BootstrapUnitIds]),
				),
			),
		database
			.select({ id: users.id, emailVerified: users.emailVerified })
			.from(users)
			.where(inArray(users.id, BootstrapAuthUserIds)),
		database
			.select({ value: count() })
			.from(accounts)
			.where(inArray(accounts.id, BootstrapAccountIds)),
		database
			.select({ value: count() })
			.from(profile)
			.where(inArray(profile.id, BootstrapProfileIdValues)),
		database
			.select({
				unitId: unitOwnership.unitId,
				profileId: unitOwnership.profileId,
			})
			.from(unitOwnership)
			.where(
				and(
					inArray(unitOwnership.unitId, BootstrapProfileIdValues),
					isNull(unitOwnership.revokedAt),
				),
			),
		database
			.select({
				profileId: platformCapabilityGrant.profileId,
				capability: platformCapabilityGrant.capability,
				grantedByProfileId: platformCapabilityGrant.grantedByProfileId,
				expiresAt: platformCapabilityGrant.expiresAt,
				revokedAt: platformCapabilityGrant.revokedAt,
				revokedByProfileId: platformCapabilityGrant.revokedByProfileId,
			})
			.from(platformCapabilityGrant)
			.where(
				and(
					inArray(
						platformCapabilityGrant.profileId,
						BootstrapPlatformAccessManifest.map((access) => access.profileId),
					),
					isNull(platformCapabilityGrant.revokedAt),
				),
			),
		database
			.select({ id: realm.id })
			.from(realm)
			.where(
				inArray(
					realm.id,
					BootstrapRealmManifest.map((value) => value.id),
				),
			),
		database
			.select({
				id: realmRuleRevision.id,
				realmId: realmRuleRevision.realmId,
				version: realmRuleRevision.version,
			})
			.from(realmRuleRevision)
			.where(eq(realmRuleRevision.id, RezicsRuleRealmManifest.rules.revisionId))
			.limit(1),
		database
			.select({
				id: realmRule.id,
				revisionId: realmRule.revisionId,
				position: realmRule.position,
			})
			.from(realmRule)
			.where(
				inArray(
					realmRule.id,
					RezicsRuleRealmManifest.rules.items.map((rule) => rule.id),
				),
			),
		database
			.select({
				id: zone.id,
				boundaryDocument: zone.boundaryDocument,
				themeDocument: zone.themeDocument,
			})
			.from(zone)
			.where(
				inArray(
					zone.id,
					OfficialZoneManifest.map((value) => value.id),
				),
			),
		database.transaction(async (tx) => {
			const features: ZoneSearchFeatureProjection[] = [];
			for (const value of OfficialZoneManifest) {
				const feature = await getZoneSearchFeature(tx, value.id);
				if (feature) features.push(feature);
			}
			return features;
		}),
		database
			.select({ unitId: unitDock.unitId, document: unitDock.document })
			.from(unitDock)
			.where(
				and(
					eq(unitDock.kind, "main"),
					isNull(unitDock.deletedAt),
					inArray(
						unitDock.unitId,
						OfficialZoneManifest.map((value) => value.id),
					),
				),
			),
		database
			.select({ id: post.id, kind: post.kind, subjectUnitId: post.subjectUnitId })
			.from(post)
			.where(
				inArray(
					post.id,
					OfficialZoneManifest.map((value) => value.wikiPost.id),
				),
			),
		database.transaction(async (tx) => {
			const pages = [];
			for (const value of OfficialZoneManifest)
				pages.push(...(await listZonePageUnits(tx, value.id)));
			return pages;
		}),
		database.transaction(async (tx) => {
			const navigations = [];
			for (const value of OfficialZoneManifest) {
				try {
					const navigation = await presentNavigationStructure(tx, {
						ownerUnitId: value.id,
						structureId: value.navigation.id,
						kind: "zone.navigation",
					});
					navigations.push({
						id: navigation.id,
						zoneId: navigation.ownerUnitId,
						document: navigation.document,
					});
				} catch (cause) {
					if (cause instanceof ContentStructureNotFound) continue;
					throw cause;
				}
			}
			return navigations;
		}),
		database
			.select({
				id: imageAsset.id,
				status: imageAsset.status,
				access: imageAsset.access,
				objectId: imageObject.id,
				storageKey: imageObject.storageKey,
			})
			.from(imageAsset)
			.innerJoin(imageObject, eq(imageObject.assetId, imageAsset.id))
			.where(eq(imageAsset.id, OfficialZoneAvatarAsset.id))
			.limit(1),
		database.select({ id: profile.id }).from(profile),
		database
			.select({
				id: profileFavoritesCollection.collectionId,
				profileId: profileFavoritesCollection.profileId,
			})
			.from(profileFavoritesCollection),
		database
			.select({ profileId: realmMember.profileId })
			.from(realmMember)
			.where(eq(realmMember.realmId, RezicsScoreRealmManifest.id)),
		database
			.select({
				profileId: profilePreference.profileId,
				defaultScoreRealmId: profilePreference.defaultScoreRealmId,
			})
			.from(profilePreference),
		database
			.select({
				profileId: unitFollow.followerProfileId,
				unitId: unitFollow.unitId,
				position: unitFollow.position,
				favorite: unitFollow.favorite,
			})
			.from(unitFollow),
		database
			.select({
				unitId: unitLocalization.unitId,
				language: unitLocalization.language,
				position: unitLocalization.position,
				title: unitLocalization.title,
				summary: unitLocalization.summary,
				avatarType: unitLocalization.avatarType,
				avatarAssetId: unitLocalization.avatarAssetId,
				avatarEmoji: unitLocalization.avatarEmoji,
				avatarIconPrefix: unitLocalization.avatarIconPrefix,
				avatarIconName: unitLocalization.avatarIconName,
				content: unitLocalization.content,
				contentStatus: unitLocalization.contentStatus,
			})
			.from(unitLocalization)
			.where(
				inArray(unitLocalization.unitId, [
					...BootstrapProfileManifest.map(
						(bootstrapProfile) => bootstrapProfile.profileId,
					),
					...BootstrapRealmManifest.map((bootstrapRealm) => bootstrapRealm.id),
					...RezicsRuleRealmManifest.rules.items.map((rule) => rule.id),
					...OfficialZoneManifest.map((officialZone) => officialZone.id),
					...OfficialZoneManifest.map((officialZone) => officialZone.wikiPost.id),
					...OfficialZoneManifest.map((officialZone) => officialZone.homePage.id),
				]),
			),
		database
			.select({
				key: apiQuotaPolicy.key,
				class: apiQuotaPolicy.class,
				schemaVersion: apiQuotaPolicyRevision.schemaVersion,
				enabled: apiQuotaPolicy.enabled,
			})
			.from(apiQuotaPolicy)
			.innerJoin(
				apiQuotaPolicyRevision,
				and(
					eq(apiQuotaPolicyRevision.policyId, apiQuotaPolicy.id),
					eq(apiQuotaPolicyRevision.revision, apiQuotaPolicy.currentRevision),
				),
			)
			.where(
				inArray(
					apiQuotaPolicy.key,
					Object.values(DefaultApiQuotaPolicies).map((value) => value.key),
				),
			),
		areAllZoneExperiencesReady(),
	]);
	return (
		unitCount[0]?.value === BootstrapUnitIds.length &&
		defaultApiQuotaPolicies.length === Object.keys(DefaultApiQuotaPolicies).length &&
		allZoneExperiencesReady &&
		Object.values(DefaultApiQuotaPolicies).every((expected) =>
			defaultApiQuotaPolicies.some(
				(actual) =>
					actual.key === expected.key &&
					actual.class === expected.class &&
					actual.schemaVersion === ApiQuotaPolicySchemaVersion &&
					(actual.class !== "standard" || actual.enabled),
			),
		) &&
		addresses.length === expectedAddresses.length &&
		expectedAddresses.every((expected) =>
			addresses.some(
				(actual) =>
					actual.targetUnitId === expected.targetUnitId &&
					actual.scopeUnitId === expected.scopeUnitId &&
					actual.slug === expected.slug,
			),
		) &&
		bootstrapUsers.length === BootstrapAuthUserIds.length &&
		bootstrapUsers.every((user) => user.emailVerified) &&
		accountCount[0]?.value === BootstrapAccountIds.length &&
		profileCount[0]?.value === BootstrapProfileIdValues.length &&
		bootstrapProfileOwners.length === BootstrapProfileIdValues.length &&
		bootstrapProfileOwners.every((owner) => owner.profileId === owner.unitId) &&
		BootstrapPlatformAccessManifest.every((access) =>
			access.capabilities.every((capability) =>
				bootstrapPlatformAccess.some(
					(grant) =>
						grant.profileId === access.profileId &&
						grant.capability === capability &&
						grant.grantedByProfileId === access.grantedByProfileId &&
						grant.expiresAt === null &&
						grant.revokedAt === null &&
						grant.revokedByProfileId === null,
				),
			),
		) &&
		officialRealms.length === BootstrapRealmManifest.length &&
		BootstrapRealmManifest.every((expected) =>
			officialRealms.some((actual) => actual.id === expected.id),
		) &&
		bootstrapRuleRevision.some(
			(revision) =>
				revision.id === RezicsRuleRealmManifest.rules.revisionId &&
				revision.realmId === RezicsRuleRealmManifest.id &&
				revision.version === RezicsRuleRealmManifest.rules.version,
		) &&
		bootstrapRules.length === RezicsRuleRealmManifest.rules.items.length &&
		RezicsRuleRealmManifest.rules.items.every((expected, position) =>
			bootstrapRules.some(
				(actual) =>
					actual.id === expected.id &&
					actual.revisionId === RezicsRuleRealmManifest.rules.revisionId &&
					actual.position === position,
			),
		) &&
		officialZones.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZones.some(
				(actual) =>
					actual.id === expected.id &&
					valuesEqual(actual.boundaryDocument, expected.boundaryDocument) &&
					valuesEqual(actual.themeDocument, expected.themeDocument),
			),
		) &&
		officialZoneSearchFeatures.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZoneSearchFeatures.some(
				(actual) =>
					actual.zoneId === expected.id &&
					actual.enabled &&
					valuesEqual(
						actual.document,
						createDefaultSearchDocument(expected.searchTemplate),
					),
			),
		) &&
		officialWikiPosts.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialWikiPosts.some(
				(actual) =>
					actual.id === expected.wikiPost.id &&
					actual.kind === "wiki" &&
					actual.subjectUnitId === expected.id,
			),
		) &&
		officialZonePages.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZonePages.some(
				(actual) =>
					actual.id === expected.homePage.id &&
					actual.zoneId === expected.id &&
					actual.placement?.structureId === expected.homePage.structureId &&
					actual.home &&
					valuesEqual(actual.document, expected.homePage.document),
			),
		) &&
		officialZoneNavigations.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZoneNavigations.some(
				(actual) =>
					actual.id === expected.navigation.id &&
					actual.zoneId === expected.id &&
					valuesEqual(actual.document, expected.navigation.document),
			),
		) &&
		officialZoneAvatar[0]?.id === OfficialZoneAvatarAsset.id &&
		officialZoneAvatar[0]?.status === "ready" &&
		officialZoneAvatar[0]?.access === "public" &&
		officialZoneAvatar[0]?.objectId === OfficialZoneAvatarAsset.objectId &&
		officialZoneAvatar[0]?.storageKey === OfficialZoneAvatarAsset.storageKey &&
		profileFavorites.length === allProfiles.length &&
		allProfiles.every((targetProfile) =>
			profileFavorites.some((favorites) => favorites.profileId === targetProfile.id),
		) &&
		BootstrapProfileManifest.every((expected) =>
			profileFavorites.some(
				(actual) =>
					actual.profileId === expected.profileId &&
					actual.id === expected.favoritesCollectionId,
			),
		) &&
		allProfiles.every((targetProfile) =>
			profileScoreMemberships.some((membership) => membership.profileId === targetProfile.id),
		) &&
		allProfiles.every((targetProfile) =>
			profilePreferences.some(
				(preference) =>
					preference.profileId === targetProfile.id &&
					preference.defaultScoreRealmId !== null,
			),
		) &&
		allProfiles.every((targetProfile) => {
			const follows = profileFollows.filter(
				(follow) => follow.profileId === targetProfile.id,
			);
			const officialFollows = OfficialZoneManifest.map((expected) =>
				follows.find((follow) => follow.unitId === expected.id),
			);
			if (officialFollows.some((follow) => !follow)) return false;
			const positions = officialFollows.flatMap((follow) =>
				follow ? [follow.position] : [],
			);
			if (
				positions.some((position, index) => {
					if (index === 0) return false;
					const previous = positions[index - 1];
					return !previous || compareFractionalPositions(previous, position) >= 0;
				})
			)
				return false;
			const firstOrdinaryPosition = follows
				.filter(
					(follow) =>
						!follow.favorite &&
						!OfficialZoneManifest.some((official) => official.id === follow.unitId),
				)
				.map((follow) => follow.position)
				.toSorted(compareFractionalPositions)[0];
			return firstOrdinaryPosition
				? positions.every(
						(position) =>
							compareFractionalPositions(position, firstOrdinaryPosition) < 0,
					)
				: true;
		}) &&
		officialZoneDocks.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZoneDocks.some(
				(actual) =>
					actual.unitId === expected.id &&
					valuesEqual(actual.document, expected.mainDockDocument),
			),
		) &&
		localizations.length === expectedLocalizations.length &&
		expectedLocalizations.every((expected) =>
			localizations.some(
				(actual) =>
					actual.unitId === expected.unitId &&
					actual.language === expected.language &&
					actual.position === expected.position &&
					actual.title === expected.title &&
					actual.summary === expected.summary &&
					actual.avatarType === ("avatarType" in expected ? expected.avatarType : null) &&
					actual.avatarAssetId ===
						("avatarAssetId" in expected ? expected.avatarAssetId : null) &&
					actual.avatarEmoji ===
						("avatarEmoji" in expected ? expected.avatarEmoji : null) &&
					actual.avatarIconPrefix ===
						("avatarIconPrefix" in expected ? expected.avatarIconPrefix : null) &&
					actual.avatarIconName ===
						("avatarIconName" in expected ? expected.avatarIconName : null) &&
					valuesEqual(actual.content, "content" in expected ? expected.content : null) &&
					actual.contentStatus ===
						("contentStatus" in expected ? expected.contentStatus : null),
			),
		)
	);
}

async function bootstrapDatabase(
	options: BootstrapOptions = FillBootstrapOptions,
): Promise<BootstrapResult> {
	assertBootstrapManifest();
	const issuedCredentials = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${BootstrapLockName}, 0))`,
		);
		await ensureSlugNamespaces(tx);
		const credentials = await ensureBootstrapProfiles(tx, options.credentialMode);
		await ensureProfileFavorites(tx);
		await ensureBootstrapPlatformAccess(tx);
		await ensureDefaultApiQuotaPolicies(tx);
		for (const realm of BootstrapRealmManifest) await ensureBootstrapRealm(tx, realm);
		await ensureScoreRealmProfileDefaults(tx);
		await ensureOfficialZoneAvatar(tx);
		await ensureOfficialZones(tx);
		await ensureAllZoneExperiences(tx);
		await ensureOfficialZoneFollows(tx);
		return credentials;
	});
	return { issuedCredentials };
}

/**
 * Owns the production-safe, idempotent Bootstrap lifecycle. Seed scenarios are
 * intentionally not reachable through this service.
 */
export class DatabaseBootstrapService {
	isReady(): Promise<boolean> {
		return isBootstrapReady();
	}

	run(options: BootstrapOptions = FillBootstrapOptions): Promise<BootstrapResult> {
		return bootstrapDatabase(options);
	}
}

export const databaseBootstrapService = new DatabaseBootstrapService();

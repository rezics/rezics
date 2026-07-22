import { hashPassword } from "better-auth/crypto";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { PortableTextDocument } from "@rezics/block";

import { database, type DatabaseTransaction } from "../database";
import {
	accounts,
	contentStructure,
	imageAsset,
	imageObject,
	post,
	profile,
	profilePreference,
	realm,
	realmMember,
	realmUnit,
	unit,
	unitAccessBinding,
	unitLocalization,
	unitDock,
	unitFollow,
	unitSlugAddress,
	users,
	zone,
	zonePage,
} from "../database/schema";
import {
	createNavigationStructure,
	presentNavigationStructure,
	replaceNavigationStructure,
} from "../content-structure/navigation";
import { ContentStructureNotFound } from "../content-structure/errors";
import { getContentStructureRevision } from "../content-structure/service";
import {
	createDockHistory,
	getDockRevisionId,
	lockDockHistory,
	updateDockHistory,
} from "../api/docks/history";
import type { ContentLanguage } from "../database/schema/contract-values";
import { compareFractionalPositions, fractionalPositionAt } from "../ordering/position";
import { storage } from "../storage";
import { insertUnit, insertUnitIfMissing } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { type BootstrapCredentialMode, generateBootstrapPassword } from "./credentials";
import { ensureOfficialZoneFollows } from "./official-zone-follows";
import {
	assertBootstrapManifest,
	BootstrapAccountIds,
	BootstrapAuthUserIds,
	BootstrapEpochIso,
	BootstrapUnitIds,
	OfficialProfileIdValues,
	OfficialProfileIds,
	OfficialProfileManifest,
	OfficialRealmManifest,
	OfficialZoneAvatarAsset,
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
		readonly avatarAssetId?: string | null;
		readonly content?: PortableTextDocument | null;
		readonly contentStatus?: "published" | null;
	},
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const desired = {
		summary: input.summary ?? null,
		avatarType: input.avatarAssetId ? ("image" as const) : null,
		avatarAssetId: input.avatarAssetId ?? null,
		avatarEmoji: null,
		avatarIconPrefix: null,
		avatarIconName: null,
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
		changed = (await ensureOwnerBinding(tx, value.profileId, value.profileId)) || changed;
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
		Tagging: new URLSearchParams(tracking).toString(),
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
	changed = (await ensureOwnerBinding(tx, value.wikiPost.id, value.ownerProfileId)) || changed;
	await tx
		.insert(realmUnit)
		.values({
			realmId: OfficialRealmManifest.id,
			unitId: value.wikiPost.id,
			status: "visible",
			postTargetingLocked: false,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing();
	if (changed)
		await recordUnitRevision(tx, {
			unitId: value.wikiPost.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Zone Wiki Post",
		});
	return changed;
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
		changed = (await ensureOfficialWikiPost(tx, value)) || changed;
		const homePageValue = {
			id: value.homePage.id,
			zoneId: value.id,
			slug: value.homePage.slug,
			titleUnitId: value.homePage.titleUnitId,
			document: value.homePage.document,
			position: fractionalPositionAt(0),
			home: true,
		};
		const { id: _homePageId, ...homePageSet } = homePageValue;
		const [storedPage] = await tx
			.select({
				id: zonePage.id,
				zoneId: zonePage.zoneId,
				slug: zonePage.slug,
				titleUnitId: zonePage.titleUnitId,
				document: zonePage.document,
				position: zonePage.position,
				home: zonePage.home,
			})
			.from(zonePage)
			.where(eq(zonePage.id, value.homePage.id))
			.limit(1);
		if (storedPage) {
			if (!valuesEqual(storedPage, homePageValue)) {
				await tx
					.update(zonePage)
					.set({ ...homePageSet, updatedAt: createdAt })
					.where(eq(zonePage.id, value.homePage.id));
				changed = true;
			}
		} else {
			await tx.insert(zonePage).values({ ...homePageValue, createdAt, updatedAt: createdAt });
			changed = true;
		}
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
					avatarAssetId: value.avatarAssetId,
					...localization,
				})) || changed;
		}
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
	const expectedAddresses = [
		...SlugNamespaceManifest.map((namespace) => ({
			targetUnitId: namespace.id,
			scopeUnitId: null,
			slug: namespace.slug,
		})),
		...OfficialProfileManifest.map((officialProfile) => ({
			targetUnitId: officialProfile.profileId,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
			slug: officialProfile.slug,
		})),
		{
			targetUnitId: OfficialRealmManifest.id,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.realms,
			slug: OfficialRealmManifest.slug,
		},
		...OfficialZoneManifest.map((officialZone) => ({
			targetUnitId: officialZone.id,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
			slug: officialZone.slug,
		})),
	];
	const expectedLocalizations = [
		...OfficialProfileManifest.flatMap((officialProfile) =>
			officialProfile.localizations.map((localization, index) => ({
				unitId: officialProfile.profileId,
				position: fractionalPositionAt(index),
				summary: null,
				...localization,
			})),
		),
		...OfficialRealmManifest.localizations.map((localization, index) => ({
			unitId: OfficialRealmManifest.id,
			position: fractionalPositionAt(index),
			...localization,
		})),
		...OfficialZoneManifest.flatMap((officialZone) =>
			officialZone.localizations.map((localization, index) => ({
				unitId: officialZone.id,
				position: fractionalPositionAt(index),
				avatarType: officialZone.avatarAssetId ? ("image" as const) : null,
				avatarAssetId: officialZone.avatarAssetId,
				avatarEmoji: null,
				avatarIconPrefix: null,
				avatarIconName: null,
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
	];
	const [
		unitCount,
		addresses,
		officialUsers,
		accountCount,
		profileCount,
		officialProfileOwners,
		officialRealm,
		officialZones,
		officialZoneDocks,
		officialWikiPosts,
		officialZonePages,
		officialZoneNavigations,
		officialZoneAvatar,
		allProfiles,
		profileFollows,
		localizations,
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
			.where(inArray(profile.id, OfficialProfileIdValues)),
		database
			.select({
				unitId: unitAccessBinding.unitId,
				profileId: unitAccessBinding.profileId,
				scope: unitAccessBinding.scope,
				expiresAt: unitAccessBinding.expiresAt,
			})
			.from(unitAccessBinding)
			.where(
				and(
					inArray(unitAccessBinding.unitId, OfficialProfileIdValues),
					eq(unitAccessBinding.subjectKind, "profile"),
					eq(unitAccessBinding.role, "owner"),
					isNull(unitAccessBinding.revokedAt),
				),
			),
		database
			.select({ id: realm.id })
			.from(realm)
			.where(eq(realm.id, OfficialRealmManifest.id))
			.limit(1),
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
		database
			.select({
				id: zonePage.id,
				zoneId: zonePage.zoneId,
				document: zonePage.document,
				home: zonePage.home,
			})
			.from(zonePage)
			.where(
				inArray(
					zonePage.id,
					OfficialZoneManifest.map((value) => value.homePage.id),
				),
			),
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
				content: unitLocalization.content,
				contentStatus: unitLocalization.contentStatus,
			})
			.from(unitLocalization)
			.where(
				inArray(unitLocalization.unitId, [
					...OfficialProfileManifest.map((officialProfile) => officialProfile.profileId),
					OfficialRealmManifest.id,
					...OfficialZoneManifest.map((officialZone) => officialZone.id),
					...OfficialZoneManifest.map((officialZone) => officialZone.wikiPost.id),
				]),
			),
	]);
	return (
		unitCount[0]?.value === BootstrapUnitIds.length &&
		addresses.length === expectedAddresses.length &&
		expectedAddresses.every((expected) =>
			addresses.some(
				(actual) =>
					actual.targetUnitId === expected.targetUnitId &&
					actual.scopeUnitId === expected.scopeUnitId &&
					actual.slug === expected.slug,
			),
		) &&
		officialUsers.length === BootstrapAuthUserIds.length &&
		officialUsers.every((user) => user.emailVerified) &&
		accountCount[0]?.value === BootstrapAccountIds.length &&
		profileCount[0]?.value === OfficialProfileIdValues.length &&
		officialProfileOwners.length === OfficialProfileIdValues.length &&
		officialProfileOwners.every(
			(owner) =>
				owner.profileId === owner.unitId &&
				owner.scope.length === 0 &&
				owner.expiresAt === null,
		) &&
		Boolean(officialRealm[0]) &&
		officialZones.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZones.some(
				(actual) =>
					actual.id === expected.id &&
					valuesEqual(actual.boundaryDocument, expected.boundaryDocument) &&
					valuesEqual(actual.themeDocument, expected.themeDocument),
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
					valuesEqual(actual.content, "content" in expected ? expected.content : null) &&
					actual.contentStatus ===
						("contentStatus" in expected ? expected.contentStatus : null),
			),
		)
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
		await ensureOfficialZoneAvatar(tx);
		await ensureOfficialZones(tx);
		await ensureOfficialZoneFollows(tx);
		return credentials;
	});
	return { issuedCredentials };
}

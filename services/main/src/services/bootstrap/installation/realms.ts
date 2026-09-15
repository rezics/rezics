import { RealmUnitCreatePermissionValues } from "@rezics/access";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import type { DatabaseTransaction } from "../../database";
import {
	accountPreference,
	contentStructure,
	imageAsset,
	imageObject,
	unitAccessGrant,
} from "../../database/schema";
import { fractionalPositionAt } from "../../ordering/position";
import { storage } from "../../storage";
import { recordUnitRevision } from "../../units/history";
import {
	BootstrapAccountManifest,
	BootstrapPlatformAdministratorProfile,
	BootstrapRealmManifest,
	OfficialRealmAvatarAsset,
	RezicsScoreRealmManifest,
	TopLevelSlugNamespaceIds,
} from "../data";
import {
	bootstrapEpoch,
	ensureBootstrapAddressedUnit,
	ensureOwnership,
	insertStarterLocalization,
} from "./common";

async function hasUnitAccessGrant(
	tx: DatabaseTransaction,
	clauses: readonly SQL[],
): Promise<boolean> {
	const [stored] = await tx
		.select({ id: unitAccessGrant.id })
		.from(unitAccessGrant)
		.where(and(...clauses))
		.limit(1);
	return Boolean(stored);
}

export async function ensureBootstrapRealm(
	tx: DatabaseTransaction,
	value: (typeof BootstrapRealmManifest)[number],
): Promise<void> {
	const createdAt = bootstrapEpoch();
	const createdUnit = await ensureBootstrapAddressedUnit(tx, {
		id: value.id,
		owner: "realm",
		values: { joinPolicy: "open" },
		scopeNamespaceId: TopLevelSlugNamespaceIds.realms,
		slug: value.slug,
	});
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
	if (!storedTaxonomy)
		await tx.insert(contentStructure).values({
			ownerUnitId: value.id,
			kind: "realm.taxonomy",
			createdAt,
			updatedAt: createdAt,
		});
	if (createdUnit)
		for (const [index, localization] of value.localizations.entries())
			await insertStarterLocalization(tx, {
				unitId: value.id,
				position: fractionalPositionAt(index),
				...localization,
			});
	await ensureOwnership(tx, value.id, value.ownerProfileId);
	for (const permission of [
		"unit.read",
		"realm.contribute",
		...RealmUnitCreatePermissionValues,
	] as const) {
		if (
			await hasUnitAccessGrant(tx, [
				eq(unitAccessGrant.unitId, value.id),
				eq(unitAccessGrant.subjectKind, "realm"),
				eq(unitAccessGrant.realmId, value.id),
				eq(unitAccessGrant.realmRelation, "member"),
				eq(unitAccessGrant.permission, permission),
			])
		)
			continue;
		await tx.insert(unitAccessGrant).values({
			unitId: value.id,
			subjectKind: "realm",
			realmId: value.id,
			realmRelation: "member",
			permission,
			scope: [],
			grantedByAuthUserId: null,
			createdAt,
			updatedAt: createdAt,
		});
	}
	for (const permission of value.authenticatedContributions
		? RealmUnitCreatePermissionValues
		: []) {
		if (
			await hasUnitAccessGrant(tx, [
				eq(unitAccessGrant.unitId, value.id),
				eq(unitAccessGrant.subjectKind, "authenticated"),
				eq(unitAccessGrant.permission, permission),
			])
		)
			continue;
		await tx.insert(unitAccessGrant).values({
			unitId: value.id,
			subjectKind: "authenticated",
			permission,
			scope: [],
			grantedByAuthUserId: null,
			createdAt,
			updatedAt: createdAt,
		});
	}
	for (const access of value.access)
		for (const permission of access.permissions) {
			if (
				await hasUnitAccessGrant(tx, [
					eq(unitAccessGrant.unitId, value.id),
					eq(unitAccessGrant.subjectKind, "auth"),
					eq(unitAccessGrant.authUserId, access.authUserId),
					eq(unitAccessGrant.permission, permission),
				])
			)
				continue;
			await tx.insert(unitAccessGrant).values({
				unitId: value.id,
				subjectKind: "auth",
				authUserId: access.authUserId,
				permission,
				scope: [],
				grantedByAuthUserId: null,
				createdAt,
				updatedAt: createdAt,
			});
		}
	if (createdUnit)
		await recordUnitRevision(tx, {
			unitId: value.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Realm",
		});
}

export async function ensureScoreRealmProfileDefaults(tx: DatabaseTransaction): Promise<void> {
	if (BootstrapAccountManifest.length) {
		await tx
			.insert(accountPreference)
			.values(
				BootstrapAccountManifest.map(({ authUserId }) => ({
					authUserId,
					defaultScoreRealmId: RezicsScoreRealmManifest.id,
				})),
			)
			.onConflictDoNothing();
	}
	await tx
		.update(accountPreference)
		.set({ defaultScoreRealmId: RezicsScoreRealmManifest.id })
		.where(
			and(
				inArray(
					accountPreference.authUserId,
					BootstrapAccountManifest.map(({ authUserId }) => authUserId),
				),
				isNull(accountPreference.defaultScoreRealmId),
			),
		);
}

export async function ensureOfficialRealmAvatar(tx: DatabaseTransaction): Promise<void> {
	const [existingAsset] = await tx
		.select({ id: imageAsset.id })
		.from(imageAsset)
		.where(eq(imageAsset.id, OfficialRealmAvatarAsset.id))
		.limit(1);
	if (existingAsset) return;
	const createdAt = bootstrapEpoch();
	const bytes = await readFile(fileURLToPath(import.meta.resolve("@rezics/brand/avatar.png")));
	const metadata = await sharp(bytes, { animated: false }).metadata();
	if (
		metadata.format !== "png" ||
		metadata.width !== OfficialRealmAvatarAsset.width ||
		metadata.height !== OfficialRealmAvatarAsset.height
	)
		throw new Error("Bundled official Realm avatar does not match its bootstrap metadata");
	const tracking = {
		image_asset_id: OfficialRealmAvatarAsset.id,
		image_object_id: OfficialRealmAvatarAsset.objectId,
		uploader_auth_user_id: BootstrapPlatformAdministratorProfile.authUserId,
	};
	await storage.put({
		Key: OfficialRealmAvatarAsset.storageKey,
		Body: bytes,
		ContentType: OfficialRealmAvatarAsset.mediaType,
		ContentLength: bytes.byteLength,
		Metadata: tracking,
	});
	await tx.insert(imageAsset).values({
		id: OfficialRealmAvatarAsset.id,
		uploaderAuthUserId: BootstrapPlatformAdministratorProfile.authUserId,
		ownerAuthUserId: BootstrapPlatformAdministratorProfile.authUserId,
		status: "ready",
		access: "public",
		createdAt,
		updatedAt: createdAt,
	});
	await tx.insert(imageObject).values({
		id: OfficialRealmAvatarAsset.objectId,
		assetId: OfficialRealmAvatarAsset.id,
		storageKey: OfficialRealmAvatarAsset.storageKey,
		mediaType: OfficialRealmAvatarAsset.mediaType,
		byteSize: bytes.byteLength,
		width: OfficialRealmAvatarAsset.width,
		height: OfficialRealmAvatarAsset.height,
		createdAt,
		updatedAt: createdAt,
	});
}

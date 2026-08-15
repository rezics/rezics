import { RealmUnitCreatePermissionValues } from "@rezics/access";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import type { DatabaseTransaction } from "../../database";
import {
	contentStructure,
	imageAsset,
	imageObject,
	profilePreference,
	realm,
	realmMember,
	unitAccessGrant,
} from "../../database/schema";
import { fractionalPositionAt } from "../../ordering/position";
import { recordUnitRevision } from "../../units/history";
import { storage } from "../../storage";
import {
	BootstrapProfileManifest,
	BootstrapRealmManifest,
	OfficialProfileIds,
	OfficialRealmAvatarAsset,
	RezicsScoreRealmManifest,
	TopLevelSlugNamespaceUnitIds,
} from "../data";
import {
	assertFields,
	bootstrapEpoch,
	ensureBootstrapAddressedUnit,
	ensureLocalization,
	ensureOwnership,
} from "./common";

export async function ensureBootstrapRealm(
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
			.where(and(eq(realmMember.realmId, value.id), eq(realmMember.profileId, memberProfileId)))
			.limit(1);
		assertFields(`Realm member ${memberProfileId}`, stored, {
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

export async function ensureScoreRealmProfileDefaults(tx: DatabaseTransaction): Promise<void> {
	if (BootstrapProfileManifest.length) {
		await tx
			.insert(realmMember)
			.values(
				BootstrapProfileManifest.map(({ profileId }) => ({
					realmId: RezicsScoreRealmManifest.id,
					profileId,
					state: "active" as const,
				})),
			)
			.onConflictDoNothing();
		await tx
			.insert(profilePreference)
			.values(
				BootstrapProfileManifest.map(({ profileId }) => ({
					profileId,
					defaultScoreRealmId: RezicsScoreRealmManifest.id,
				})),
			)
			.onConflictDoNothing();
	}
	await tx
		.update(profilePreference)
		.set({ defaultScoreRealmId: RezicsScoreRealmManifest.id })
		.where(
			and(
				inArray(
					profilePreference.profileId,
					BootstrapProfileManifest.map(({ profileId }) => profileId),
				),
				isNull(profilePreference.defaultScoreRealmId),
			),
		);
}

export async function ensureOfficialRealmAvatar(tx: DatabaseTransaction): Promise<void> {
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
		uploader_profile_id: OfficialProfileIds.editorial,
	};
	await storage.put({
		Key: OfficialRealmAvatarAsset.storageKey,
		Body: bytes,
		ContentType: OfficialRealmAvatarAsset.mediaType,
		ContentLength: bytes.byteLength,
		Metadata: tracking,
	});
	await tx
		.insert(imageAsset)
		.values({
			id: OfficialRealmAvatarAsset.id,
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
			id: OfficialRealmAvatarAsset.objectId,
			assetId: OfficialRealmAvatarAsset.id,
			storageKey: OfficialRealmAvatarAsset.storageKey,
			mediaType: OfficialRealmAvatarAsset.mediaType,
			byteSize: bytes.byteLength,
			width: OfficialRealmAvatarAsset.width,
			height: OfficialRealmAvatarAsset.height,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoUpdate({
			target: imageObject.id,
			set: {
				assetId: OfficialRealmAvatarAsset.id,
				storageKey: OfficialRealmAvatarAsset.storageKey,
				mediaType: OfficialRealmAvatarAsset.mediaType,
				byteSize: bytes.byteLength,
				width: OfficialRealmAvatarAsset.width,
				height: OfficialRealmAvatarAsset.height,
				updatedAt: createdAt,
			},
		});
}

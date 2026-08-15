import { and, asc, count, eq, inArray, isNull, notInArray } from "drizzle-orm";

import { database } from "../database";
import {
	accounts,
	apiQuotaPolicy,
	apiQuotaPolicyRevision,
	collection,
	collectionStructureRevisionHead,
	contentStructure,
	contentStructureNode,
	creditAttribution,
	imageAsset,
	imageObject,
	platformCapabilityGrant,
	post,
	profile,
	profileFavoritesCollection,
	profilePreference,
	realm,
	realmMember,
	unit,
	unitDock,
	unitFollow,
	unitLocalization,
	unitOwnership,
	unitSlugAddress,
	users,
	zone,
	zonePage,
} from "../database/schema";
import { DefaultApiQuotaPolicies } from "../auth/api-quota/policy-schema";
import { ContentStructureNotFound } from "../content-structure/errors";
import { presentNavigationStructure } from "../content-structure/navigation";
import {
	BootstrapAccountIds,
	BootstrapAuthUserIds,
	BootstrapPlatformAccessManifest,
	BootstrapProfileIdValues,
	BootstrapProfileManifest,
	BootstrapRealmManifest,
	BootstrapUnitIds,
	CuratedCreationTagCollectionManifest,
	OfficialRealmAvatarAsset,
	OfficialZoneManifest,
	RezicsScoreRealmManifest,
} from "./data";

export async function inspectInitialInstallationBundle() {
	const [
		unitCount,
		addresses,
		bootstrapUsers,
		accountCount,
		profileCount,
		bootstrapProfileOwners,
		curatedTagCollections,
		curatedTagCollectionOwners,
		curatedTagCollectionPublishers,
		curatedTagCollectionStructureHeads,
		bootstrapPlatformAccess,
		officialRealms,
		officialZones,
		officialZoneDocks,
		officialWikiPosts,
		officialZonePages,
		officialZoneNavigations,
		officialRealmAvatar,
		bootstrapProfiles,
		profileFavorites,
		profileScoreMemberships,
		profilePreferences,
		profileFollows,
		firstOrdinaryFollowPositions,
		localizations,
		defaultApiQuotaPolicies,
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
			.select({ id: collection.id })
			.from(collection)
			.where(
				inArray(
					collection.id,
					CuratedCreationTagCollectionManifest.map((value) => value.id),
				),
			),
		database
			.select({
				unitId: unitOwnership.unitId,
				profileId: unitOwnership.profileId,
			})
			.from(unitOwnership)
			.where(
				and(
					inArray(
						unitOwnership.unitId,
						CuratedCreationTagCollectionManifest.map((value) => value.id),
					),
					isNull(unitOwnership.revokedAt),
				),
			),
		database
			.select({
				sourceUnitId: creditAttribution.sourceUnitId,
				creditedUnitId: creditAttribution.creditedUnitId,
				role: creditAttribution.role,
			})
			.from(creditAttribution)
			.where(
				and(
					inArray(
						creditAttribution.sourceUnitId,
						CuratedCreationTagCollectionManifest.map((value) => value.id),
					),
					eq(creditAttribution.role, "publisher"),
				),
			),
		database
			.select({ collectionId: collectionStructureRevisionHead.collectionId })
			.from(collectionStructureRevisionHead)
			.where(
				inArray(
					collectionStructureRevisionHead.collectionId,
					CuratedCreationTagCollectionManifest.map((value) => value.id),
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
				id: zone.id,
				filterDocument: zone.filterDocument,
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
				unitKind: unit.kind,
				deletedAt: unit.deletedAt,
				postKind: post.kind,
				subjectUnitId: post.subjectUnitId,
				structureId: contentStructure.id,
			})
			.from(zonePage)
			.innerJoin(unit, eq(unit.id, zonePage.id))
			.innerJoin(post, eq(post.id, zonePage.id))
			.innerJoin(
				contentStructureNode,
				and(
					eq(contentStructureNode.contentUnitId, zonePage.id),
					isNull(contentStructureNode.deletedAt),
				),
			)
			.innerJoin(
				contentStructure,
				and(
					eq(contentStructure.id, contentStructureNode.structureId),
					eq(contentStructure.kind, "page-structure"),
					isNull(contentStructure.deletedAt),
				),
			)
			.where(
				inArray(
					zonePage.id,
					OfficialZoneManifest.map(({ homePage }) => homePage.id),
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
				mediaType: imageObject.mediaType,
				byteSize: imageObject.byteSize,
				width: imageObject.width,
				height: imageObject.height,
			})
			.from(imageAsset)
			.innerJoin(imageObject, eq(imageObject.assetId, imageAsset.id))
			.where(eq(imageAsset.id, OfficialRealmAvatarAsset.id))
			.limit(1),
		database
			.select({ id: profile.id })
			.from(profile)
			.where(inArray(profile.id, BootstrapProfileIdValues)),
		database
			.select({
				id: profileFavoritesCollection.collectionId,
				profileId: profileFavoritesCollection.profileId,
			})
			.from(profileFavoritesCollection)
			.where(inArray(profileFavoritesCollection.profileId, BootstrapProfileIdValues)),
		database
			.select({ profileId: realmMember.profileId })
			.from(realmMember)
			.where(
				and(
					eq(realmMember.realmId, RezicsScoreRealmManifest.id),
					inArray(realmMember.profileId, BootstrapProfileIdValues),
				),
			),
		database
			.select({
				profileId: profilePreference.profileId,
				defaultScoreRealmId: profilePreference.defaultScoreRealmId,
			})
			.from(profilePreference)
			.where(inArray(profilePreference.profileId, BootstrapProfileIdValues)),
		database
			.select({
				profileId: unitFollow.followerProfileId,
				unitId: unitFollow.unitId,
				position: unitFollow.position,
				favorite: unitFollow.favorite,
			})
			.from(unitFollow)
			.where(
				and(
					inArray(unitFollow.followerProfileId, BootstrapProfileIdValues),
					inArray(
						unitFollow.unitId,
						OfficialZoneManifest.map(({ id }) => id),
					),
				),
			),
		Promise.all(
			BootstrapProfileIdValues.map(async (profileId) => {
				const [follow] = await database
					.select({ position: unitFollow.position })
					.from(unitFollow)
					.where(
						and(
							eq(unitFollow.followerProfileId, profileId),
							eq(unitFollow.favorite, false),
							notInArray(
								unitFollow.unitId,
								OfficialZoneManifest.map(({ id }) => id),
							),
						),
					)
					.orderBy(asc(unitFollow.position), asc(unitFollow.unitId))
					.limit(1);
				return { profileId, position: follow?.position ?? null };
			}),
		),
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
					...BootstrapProfileManifest.map((bootstrapProfile) => bootstrapProfile.profileId),
					...CuratedCreationTagCollectionManifest.map((curatedCollection) => curatedCollection.id),
					...BootstrapRealmManifest.map((bootstrapRealm) => bootstrapRealm.id),
					...OfficialZoneManifest.map((officialZone) => officialZone.id),
					...OfficialZoneManifest.map((officialZone) => officialZone.wikiPost.id),
					...OfficialZoneManifest.map((officialZone) => officialZone.homePage.id),
				]),
			),
		database
			.select({
				key: apiQuotaPolicy.key,
				subjectKind: apiQuotaPolicy.subjectKind,
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
	]);
	return {
		unitCount,
		addresses,
		bootstrapUsers,
		accountCount,
		profileCount,
		bootstrapProfileOwners,
		curatedTagCollections,
		curatedTagCollectionOwners,
		curatedTagCollectionPublishers,
		curatedTagCollectionStructureHeads,
		bootstrapPlatformAccess,
		officialRealms,
		officialZones,
		officialZoneDocks,
		officialWikiPosts,
		officialZonePages,
		officialZoneNavigations,
		officialRealmAvatar,
		bootstrapProfiles,
		profileFavorites,
		profileScoreMemberships,
		profilePreferences,
		profileFollows,
		firstOrdinaryFollowPositions,
		localizations,
		defaultApiQuotaPolicies,
	};
}

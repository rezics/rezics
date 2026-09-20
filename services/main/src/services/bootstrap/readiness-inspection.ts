import { referenceValue } from "@rezics/schema/postgres/knowledge/reference-value";
import { readBootstrapPlatformIdentityIds } from "./core";
import { and, asc, count, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

import { DefaultApiQuotaPolicies } from "../auth/api-quota/policy-schema";
import { ContentStructureNotFound } from "../content-structure/errors";
import { presentNavigationStructure } from "../content-structure/navigation";
import { database } from "../database";
import {
	accountPreference,
	accounts,
	apiQuotaPolicy,
	apiQuotaPolicyRevision,
	authEntity,
	collection,
	collectionStructureRevisionHead,
	contentStructure,
	contentStructureNode,
	creditAttribution,
	entityIdentity,
	entityParticipation,
	entityPresentation,
	imageAsset,
	imageObject,
	participationGrant,
	platformCapabilityGrant,
	post,
	realm,
	unitDock,
	accountFollowPreference,
	unitLocalization,
	unitOwnership,
	unitSlugAddress,
	users,
	zone,
	zonePage,
} from "../database/schema";
import {
	BootstrapAccountIds,
	BootstrapAccountManifest,
	BootstrapAuthUserIds,
	BootstrapPlatformAccessManifest,
	BootstrapProfileIdValues,
	BootstrapRealmManifest,
	BootstrapUnitIds,
	CuratedCreationTagCollectionManifest,
	OfficialRealmAvatarAsset,
	OfficialZoneManifest,
} from "./data";

export async function inspectInitialInstallationBundle() {
	const [
		unitCount,
		addresses,
		bootstrapUsers,
		accountCount,
		profileCount,
		bootstrapEntityControls,
		bootstrapEntityPresentations,
		bootstrapControlGrants,
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
		accountPreferences,
		profileFollows,
		firstOrdinaryFollowPositions,
		localizations,
		defaultApiQuotaPolicies,
	] = await Promise.all([
		readBootstrapPlatformIdentityIds(database).then((ids) => [{ value: ids.length }]),
		database
			.select({
				targetUnitId: unitSlugAddress.targetUnitId,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				scopeNamespaceId: unitSlugAddress.scopeNamespaceId,
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
			.from(entityIdentity)
			.where(inArray(entityIdentity.id, BootstrapProfileIdValues)),
		database
			.select()
			.from(entityParticipation)
			.where(inArray(entityParticipation.entityId, BootstrapProfileIdValues)),
		database
			.select()
			.from(entityPresentation)
			.where(inArray(entityPresentation.entityId, BootstrapProfileIdValues)),
		database
			.select()
			.from(participationGrant)
			.where(
				and(
					inArray(participationGrant.actingEntityId, BootstrapProfileIdValues),
					isNull(participationGrant.revokedAt),
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
				creditedEntityId: creditAttribution.creditedEntityId,
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
				authUserId: platformCapabilityGrant.authUserId,
				capability: platformCapabilityGrant.capability,
				grantedByAuthUserId: platformCapabilityGrant.grantedByAuthUserId,
				expiresAt: platformCapabilityGrant.expiresAt,
				revokedAt: platformCapabilityGrant.revokedAt,
				revokedByAuthUserId: platformCapabilityGrant.revokedByAuthUserId,
			})
			.from(platformCapabilityGrant)
			.where(
				and(
					inArray(
						platformCapabilityGrant.authUserId,
						BootstrapPlatformAccessManifest.map((access) => access.authUserId),
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
				appearanceDocument: zone.appearanceDocument,
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
				unitKind: sql<"post">`'post'`,
				deletedAt: post.deletedAt,
				postKind: post.kind,
				subjectUnitId: post.subjectUnitId,
				structureId: contentStructure.id,
			})
			.from(zonePage)
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
			.select({ id: authEntity.entityId, authUserId: authEntity.authUserId })
			.from(authEntity)
			.where(
				inArray(
					authEntity.authUserId,
					BootstrapAccountManifest.map((value) => value.authUserId),
				),
			),
		database
			.select({
				authUserId: accountPreference.authUserId,
				defaultScoreRealmId: accountPreference.defaultScoreRealmId,
			})
			.from(accountPreference)
			.where(
				inArray(
					accountPreference.authUserId,
					BootstrapAccountManifest.map((value) => value.authUserId),
				),
			),
		database
			.select({
				profileId: accountFollowPreference.followerEntityId,
				unitId: referenceValue.targetZoneId,
				position: accountFollowPreference.position,
				favorite: accountFollowPreference.favorite,
			})
			.from(accountFollowPreference)
			.innerJoin(referenceValue, eq(referenceValue.id, accountFollowPreference.targetReferenceId))
			.where(
				and(
					inArray(accountFollowPreference.followerEntityId, BootstrapProfileIdValues),
					inArray(
						referenceValue.targetZoneId,
						OfficialZoneManifest.map(({ id }) => id),
					),
				),
			),
		Promise.all(
			BootstrapProfileIdValues.map(async (profileId) => {
				const [follow] = await database
					.select({ position: accountFollowPreference.position })
					.from(accountFollowPreference)
					.where(
						and(
							eq(accountFollowPreference.followerEntityId, profileId),
							eq(accountFollowPreference.favorite, false),
							notInArray(
								accountFollowPreference.targetReferenceId,
								database
									.select({ id: referenceValue.id })
									.from(referenceValue)
									.where(
										inArray(
											referenceValue.targetZoneId,
											OfficialZoneManifest.map(({ id }) => id),
										),
									),
							),
						),
					)
					.orderBy(
						asc(accountFollowPreference.position),
						asc(accountFollowPreference.targetReferenceId),
					)
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
		bootstrapEntityControls,
		bootstrapEntityPresentations,
		bootstrapControlGrants,
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
		accountPreferences,
		profileFollows,
		firstOrdinaryFollowPositions,
		localizations,
		defaultApiQuotaPolicies,
	};
}

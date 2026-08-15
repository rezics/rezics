import {
	ApiQuotaPolicySchemaVersion,
	DefaultApiQuotaPolicies,
} from "../auth/api-quota/policy-schema";
import { compareFractionalPositions, fractionalPositionAt } from "../ordering/position";
import { avatarReferenceToColumns } from "../units/localization";
import {
	BootstrapAccountIds,
	BootstrapAuthUserIds,
	BootstrapPlatformAccessManifest,
	BootstrapProfileIdValues,
	BootstrapProfileManifest,
	BootstrapRealmManifest,
	BootstrapUnitIds,
	CuratedCreationTagCollectionManifest,
	OfficialProfileIds,
	OfficialRealmAvatarAsset,
	OfficialZoneManifest,
	SlugNamespaceManifest,
	TopLevelSlugNamespaceUnitIds,
} from "./data";
import { inspectInitialInstallationBundle } from "./readiness-inspection";
import { bootstrapValuesEqual } from "./value-comparison";

export async function isInitialInstallationBundleReady(): Promise<boolean> {
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
		...CuratedCreationTagCollectionManifest.flatMap((curatedCollection) =>
			curatedCollection.localizations.map((localization, index) => ({
				unitId: curatedCollection.id,
				position: fractionalPositionAt(index),
				...localization,
			})),
		),
		...BootstrapRealmManifest.flatMap((bootstrapRealm) =>
			bootstrapRealm.localizations.map((localization, index) => ({
				unitId: bootstrapRealm.id,
				position: fractionalPositionAt(index),
				...avatarReferenceToColumns("avatar" in localization ? localization.avatar : null),
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
	const {
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
	} = await inspectInitialInstallationBundle();
	return (
		unitCount[0]?.value === BootstrapUnitIds.length &&
		defaultApiQuotaPolicies.length === Object.keys(DefaultApiQuotaPolicies).length &&
		Object.values(DefaultApiQuotaPolicies).every((expected) =>
			defaultApiQuotaPolicies.some(
				(actual) =>
					actual.key === expected.key &&
					actual.subjectKind === expected.subjectKind &&
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
		curatedTagCollections.length === CuratedCreationTagCollectionManifest.length &&
		CuratedCreationTagCollectionManifest.every((expected) =>
			curatedTagCollections.some((actual) => actual.id === expected.id),
		) &&
		curatedTagCollectionOwners.length === CuratedCreationTagCollectionManifest.length &&
		CuratedCreationTagCollectionManifest.every((expected) =>
			curatedTagCollectionOwners.some(
				(actual) =>
					actual.unitId === expected.id && actual.profileId === OfficialProfileIds.editorial,
			),
		) &&
		curatedTagCollectionPublishers.length === CuratedCreationTagCollectionManifest.length &&
		CuratedCreationTagCollectionManifest.every((expected) =>
			curatedTagCollectionPublishers.some(
				(actual) =>
					actual.sourceUnitId === expected.id &&
					actual.creditedUnitId === OfficialProfileIds.editorial &&
					actual.role === "publisher",
			),
		) &&
		curatedTagCollectionStructureHeads.length === CuratedCreationTagCollectionManifest.length &&
		CuratedCreationTagCollectionManifest.every((expected) =>
			curatedTagCollectionStructureHeads.some((actual) => actual.collectionId === expected.id),
		) &&
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
		officialZones.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZones.some(
				(actual) =>
					actual.id === expected.id &&
					bootstrapValuesEqual(actual.filterDocument, expected.filterDocument) &&
					bootstrapValuesEqual(actual.themeDocument, expected.themeDocument),
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
					actual.unitKind === "zone_page" &&
					actual.deletedAt === null &&
					actual.postKind === "page" &&
					actual.subjectUnitId === expected.id &&
					actual.structureId === expected.homePage.structureId,
			),
		) &&
		officialZoneNavigations.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZoneNavigations.some(
				(actual) =>
					actual.id === expected.navigation.id &&
					actual.zoneId === expected.id &&
					bootstrapValuesEqual(actual.document, expected.navigation.document),
			),
		) &&
		officialRealmAvatar[0]?.id === OfficialRealmAvatarAsset.id &&
		officialRealmAvatar[0]?.status === "ready" &&
		officialRealmAvatar[0]?.access === "public" &&
		officialRealmAvatar[0]?.objectId === OfficialRealmAvatarAsset.objectId &&
		officialRealmAvatar[0]?.storageKey === OfficialRealmAvatarAsset.storageKey &&
		officialRealmAvatar[0]?.mediaType === OfficialRealmAvatarAsset.mediaType &&
		officialRealmAvatar[0]?.byteSize !== null &&
		officialRealmAvatar[0].byteSize > 0 &&
		officialRealmAvatar[0]?.width === OfficialRealmAvatarAsset.width &&
		officialRealmAvatar[0]?.height === OfficialRealmAvatarAsset.height &&
		profileFavorites.length === bootstrapProfiles.length &&
		bootstrapProfiles.every((targetProfile) =>
			profileFavorites.some((favorites) => favorites.profileId === targetProfile.id),
		) &&
		BootstrapProfileManifest.every((expected) =>
			profileFavorites.some(
				(actual) =>
					actual.profileId === expected.profileId && actual.id === expected.favoritesCollectionId,
			),
		) &&
		bootstrapProfiles.every((targetProfile) =>
			profileScoreMemberships.some((membership) => membership.profileId === targetProfile.id),
		) &&
		bootstrapProfiles.every((targetProfile) =>
			profilePreferences.some(
				(preference) =>
					preference.profileId === targetProfile.id && preference.defaultScoreRealmId !== null,
			),
		) &&
		bootstrapProfiles.every((targetProfile) => {
			const follows = profileFollows.filter((follow) => follow.profileId === targetProfile.id);
			const officialFollows = OfficialZoneManifest.map((expected) =>
				follows.find((follow) => follow.unitId === expected.id),
			);
			if (officialFollows.some((follow) => !follow)) return false;
			const positions = officialFollows.flatMap((follow) => (follow ? [follow.position] : []));
			if (
				positions.some((position, index) => {
					if (index === 0) return false;
					const previous = positions[index - 1];
					return !previous || compareFractionalPositions(previous, position) >= 0;
				})
			)
				return false;
			const firstOrdinaryPosition = firstOrdinaryFollowPositions.find(
				(follow) => follow.profileId === targetProfile.id,
			)?.position;
			return firstOrdinaryPosition
				? positions.every(
						(position) => compareFractionalPositions(position, firstOrdinaryPosition) < 0,
					)
				: true;
		}) &&
		officialZoneDocks.length === OfficialZoneManifest.length &&
		OfficialZoneManifest.every((expected) =>
			officialZoneDocks.some(
				(actual) =>
					actual.unitId === expected.id &&
					bootstrapValuesEqual(actual.document, expected.mainDockDocument),
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
					actual.avatarAssetId === ("avatarAssetId" in expected ? expected.avatarAssetId : null) &&
					actual.avatarEmoji === ("avatarEmoji" in expected ? expected.avatarEmoji : null) &&
					actual.avatarIconPrefix ===
						("avatarIconPrefix" in expected ? expected.avatarIconPrefix : null) &&
					actual.avatarIconName ===
						("avatarIconName" in expected ? expected.avatarIconName : null) &&
					bootstrapValuesEqual(actual.content, "content" in expected ? expected.content : null) &&
					actual.contentStatus === ("contentStatus" in expected ? expected.contentStatus : null),
			),
		)
	);
}

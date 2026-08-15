import { BootstrapProfileManifest, SlugNamespaceManifest } from "./foundation";
import { CuratedCreationTagCollectionManifest } from "./collections";
import { BootstrapRealmManifest, OfficialRealmAvatarAsset } from "./realms";
import { OfficialZoneManifest } from "./zones";

export * from "./collections";
export * from "./foundation";
export * from "./realms";
export * from "./zones";

export const BootstrapUnitIds = [
	...SlugNamespaceManifest.map((namespace) => namespace.id),
	...BootstrapProfileManifest.map((profile) => profile.profileId),
	...BootstrapProfileManifest.map((profile) => profile.favoritesCollectionId),
	...CuratedCreationTagCollectionManifest.map((collection) => collection.id),
	...BootstrapRealmManifest.map((realm) => realm.id),
	...OfficialZoneManifest.map((zone) => zone.id),
	...OfficialZoneManifest.map((zone) => zone.wikiPost.id),
	...OfficialZoneManifest.map((zone) => zone.homePage.id),
] as const;

export const BootstrapAuthUserIds = BootstrapProfileManifest.map((profile) => profile.authUserId);
export const BootstrapAccountIds = BootstrapProfileManifest.map((profile) => profile.accountId);

export const ReservedBootstrapUuidv7s = [
	...BootstrapUnitIds,
	...BootstrapAuthUserIds,
	...BootstrapAccountIds,
	...OfficialZoneManifest.map((zone) => zone.homePage.structureId),
	...OfficialZoneManifest.map((zone) => zone.navigation.id),
	OfficialRealmAvatarAsset.id,
	OfficialRealmAvatarAsset.objectId,
] as const;

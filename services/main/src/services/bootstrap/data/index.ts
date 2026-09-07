import { CuratedCreationTagCollectionManifest } from "./collections";
import { ContentLabelRegistryIds } from "./content-labels";
import {
	BootstrapAccountManifest,
	BootstrapProfileManifest,
	SlugNamespaceManifest,
} from "./foundation";
import { BootstrapRealmManifest, OfficialRealmAvatarAsset } from "./realms";
import { OfficialZoneManifest } from "./zones";

export * from "./collections";
export * from "./content-labels";
export * from "./foundation";
export * from "./realms";
export * from "./zones";

export const BootstrapUnitIds = [
	...SlugNamespaceManifest.map((namespace) => namespace.id),
	...CuratedCreationTagCollectionManifest.map((collection) => collection.id),
	...ContentLabelRegistryIds,
	...BootstrapRealmManifest.map((realm) => realm.id),
	...OfficialZoneManifest.map((zone) => zone.id),
	...OfficialZoneManifest.map((zone) => zone.wikiPost.id),
	...OfficialZoneManifest.map((zone) => zone.homePage.id),
] as const;

export const BootstrapAuthUserIds = BootstrapAccountManifest.map((profile) => profile.authUserId);
export const BootstrapAccountIds = BootstrapAccountManifest.map((profile) => profile.accountId);

export const BootstrapEntityIds = BootstrapProfileManifest.map((value) => value.profileId);

export const ReservedBootstrapUuidv7s = [
	...BootstrapEntityIds,
	...BootstrapUnitIds,
	...BootstrapAuthUserIds,
	...BootstrapAccountIds,
	...OfficialZoneManifest.map((zone) => zone.homePage.structureId),
	...OfficialZoneManifest.map((zone) => zone.navigation.id),
	OfficialRealmAvatarAsset.id,
	OfficialRealmAvatarAsset.objectId,
] as const;

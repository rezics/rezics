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

/** Fixed concrete owner references for installation checks; routing namespaces are separate control identities. */
export const BootstrapPlatformReferences = [
	...CuratedCreationTagCollectionManifest.map((value) => ({
		owner: "collection" as const,
		id: value.id,
	})),
	...ContentLabelRegistryIds.map((id) => ({ owner: "tag" as const, id })),
	...BootstrapRealmManifest.map((value) => ({ owner: "realm" as const, id: value.id })),
	...OfficialZoneManifest.map((value) => ({ owner: "zone" as const, id: value.id })),
	...OfficialZoneManifest.flatMap((value) => [
		{ owner: "post" as const, id: value.wikiPost.id },
		{ owner: "post" as const, id: value.homePage.id },
	]),
] as const;
export const BootstrapUnitIds = BootstrapPlatformReferences.map((reference) => reference.id);
export const BootstrapNamespaceIds = SlugNamespaceManifest.map((namespace) => namespace.id);

export const BootstrapAuthUserIds = BootstrapAccountManifest.map((profile) => profile.authUserId);
export const BootstrapAccountIds = BootstrapAccountManifest.map((profile) => profile.accountId);

export const BootstrapEntityIds = BootstrapProfileManifest.map((value) => value.profileId);

export const ReservedBootstrapUuidv7s = [
	...BootstrapEntityIds,
	...BootstrapUnitIds,
	...BootstrapNamespaceIds,
	...BootstrapAuthUserIds,
	...BootstrapAccountIds,
	...OfficialZoneManifest.map((zone) => zone.homePage.structureId),
	...OfficialZoneManifest.map((zone) => zone.navigation.id),
	OfficialRealmAvatarAsset.id,
	OfficialRealmAvatarAsset.objectId,
] as const;

import type { GetApiRealmsByRealmIdStatus200 } from "@rezics/openapi-tanstack-query";

import {
	RealmSettingsSectionIds,
	type RealmSettingsSectionId,
} from "./model/realm-settings-section";

type RealmMembership = GetApiRealmsByRealmIdStatus200["viewerMembership"];
type RealmCapabilities = GetApiRealmsByRealmIdStatus200["capabilities"];

export function canOpenRealmSettings(capabilities: RealmCapabilities) {
	return Object.values(capabilities).some(Boolean);
}

export function getRealmSettingsSectionIds(
	capabilities: RealmCapabilities,
): readonly RealmSettingsSectionId[] {
	if (!canOpenRealmSettings(capabilities)) return [];
	return RealmSettingsSectionIds.filter((sectionId) => {
		if (sectionId === "profile") return capabilities.canUpdateSettings;
		if (sectionId === "members") return capabilities.canReadMembers;
		if (sectionId === "member-access") return capabilities.canManageMembers;
		if (sectionId === "rules") return capabilities.canPublishRules;
		if (sectionId === "pins") return capabilities.canManagePins;
		if (sectionId === "access") return capabilities.canManageAccess;
		if (sectionId === "moderation") return capabilities.canModerateUnits;
		return true;
	});
}

export function isRealmOwner(membership: RealmMembership) {
	return membership?.state === "active" && membership.role === "owner";
}

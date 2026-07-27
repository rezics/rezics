import type { GetApiRealmsByRealmIdStatus200 } from "@rezics/openapi-tanstack-query";

import {
	RealmSettingsSectionIds,
	type RealmSettingsSectionId,
} from "./model/realm-settings-section";

type RealmMembership = GetApiRealmsByRealmIdStatus200["viewerMembership"];
type RealmCapabilities = GetApiRealmsByRealmIdStatus200["capabilities"];

function hasRealmManagementCapability(capabilities: RealmCapabilities) {
	return (
		capabilities.canUpdateSettings ||
		capabilities.canReadMembers ||
		capabilities.canManageMembers ||
		capabilities.canUpdateRules ||
		capabilities.canManagePins ||
		capabilities.canModerateUnits ||
		capabilities.canManageAccess ||
		capabilities.canRestoreHistory
	);
}

export function canOpenRealmSettings(capabilities: RealmCapabilities, canManageDocks = false) {
	return canManageDocks || hasRealmManagementCapability(capabilities);
}

export function getRealmSettingsSectionIds(
	capabilities: RealmCapabilities,
	canManageDocks = false,
): readonly RealmSettingsSectionId[] {
	if (!canOpenRealmSettings(capabilities, canManageDocks)) return [];
	const hasRealmCapability = hasRealmManagementCapability(capabilities);
	return RealmSettingsSectionIds.filter((sectionId) => {
		if (sectionId === "profile") return capabilities.canUpdateSettings;
		if (sectionId === "members") return capabilities.canReadMembers;
		if (sectionId === "rules") return capabilities.canUpdateRules;
		if (sectionId === "pins") return capabilities.canManagePins;
		if (sectionId === "docks") return canManageDocks;
		if (sectionId === "access") return capabilities.canManageAccess;
		if (sectionId === "moderation") return capabilities.canModerateUnits;
		return hasRealmCapability;
	});
}

export function isRealmOwner(membership: RealmMembership) {
	return membership?.state === "active" && membership.isOwner;
}

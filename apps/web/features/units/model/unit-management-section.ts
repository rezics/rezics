export const UnitManagementSectionIds = [
	"content",
	"metadata",
	"tags",
	"realms",
	"access",
	"history",
] as const;

export type UnitManagementSectionId = (typeof UnitManagementSectionIds)[number];

export function isUnitManagementSectionId(value: string): value is UnitManagementSectionId {
	return UnitManagementSectionIds.some((sectionId) => sectionId === value);
}

type UnitCapabilities = GetApiUnitsByTypeByUnitIdStatus200["capabilities"];

export function canOpenUnitManagement(capabilities: UnitCapabilities) {
	return (
		capabilities.canEdit ||
		capabilities.canManageAccess ||
		capabilities.canManageAssociations ||
		capabilities.canCurateTags ||
		capabilities.canManageRealmPublications
	);
}

export function getUnitManagementSectionIds(
	_type: UnitType,
	capabilities: UnitCapabilities,
): readonly UnitManagementSectionId[] {
	if (!canOpenUnitManagement(capabilities)) return [];
	const hasUnitCapability =
		capabilities.canEdit ||
		capabilities.canManageAccess ||
		capabilities.canManageAssociations ||
		capabilities.canCurateTags ||
		capabilities.canManageRealmPublications;
	return UnitManagementSectionIds.filter((sectionId) => {
		if (sectionId === "content" || sectionId === "metadata") return capabilities.canEdit;
		if (sectionId === "tags") return capabilities.canCurateTags;
		if (sectionId === "realms") return capabilities.canManageRealmPublications;
		if (sectionId === "access") return capabilities.canManageAccess;
		return sectionId === "history" && hasUnitCapability;
	});
}
import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

import type { UnitType } from "../unit-types";

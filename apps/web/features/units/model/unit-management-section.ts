export const UnitManagementSectionIds = [
	"basic",
	"localizations",
	"relationships",
	"content-structure",
	"releases",
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
		capabilities.canEdit || capabilities.canManageAccess || capabilities.canManageAssociations
	);
}

export function getUnitManagementSectionIds(
	type: UnitType,
	capabilities: UnitCapabilities,
): readonly UnitManagementSectionId[] {
	if (!canOpenUnitManagement(capabilities)) return [];
	return UnitManagementSectionIds.filter((sectionId) => {
		if (sectionId === "basic" || sectionId === "localizations") return capabilities.canEdit;
		if (sectionId === "relationships")
			return capabilities.canEdit || capabilities.canManageAssociations;
		if (sectionId === "content-structure") return type === "book" && capabilities.canEdit;
		if (sectionId === "releases") return type === "series" && capabilities.canEdit;
		if (sectionId === "access") return capabilities.canManageAccess;
		return true;
	});
}
import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

import type { UnitType } from "../unit-types";

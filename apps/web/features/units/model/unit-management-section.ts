export const UnitManagementSectionIds = [
	"basic",
	"localizations",
	"relationships",
	"content-structure",
	"releases",
	"docks",
	"access",
	"history",
] as const;

export type UnitManagementSectionId = (typeof UnitManagementSectionIds)[number];

export function isUnitManagementSectionId(value: string): value is UnitManagementSectionId {
	return UnitManagementSectionIds.some((sectionId) => sectionId === value);
}

type UnitCapabilities = GetApiUnitsByTypeByUnitIdStatus200["capabilities"];

export function canOpenUnitManagement(capabilities: UnitCapabilities, canManageDocks = false) {
	return (
		canManageDocks ||
		capabilities.canEdit ||
		capabilities.canManageAccess ||
		capabilities.canManageAssociations
	);
}

export function getUnitManagementSectionIds(
	type: UnitType,
	capabilities: UnitCapabilities,
	canManageDocks = false,
): readonly UnitManagementSectionId[] {
	if (!canOpenUnitManagement(capabilities, canManageDocks)) return [];
	const hasUnitCapability =
		capabilities.canEdit || capabilities.canManageAccess || capabilities.canManageAssociations;
	return UnitManagementSectionIds.filter((sectionId) => {
		if (sectionId === "basic" || sectionId === "localizations") return capabilities.canEdit;
		if (sectionId === "relationships")
			return capabilities.canEdit || capabilities.canManageAssociations;
		if (sectionId === "content-structure") return type !== "series" && capabilities.canEdit;
		if (sectionId === "releases") return type === "series" && capabilities.canEdit;
		if (sectionId === "docks") return type !== "series" && canManageDocks;
		if (sectionId === "access") return capabilities.canManageAccess;
		return hasUnitCapability;
	});
}
import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

import type { UnitType } from "../unit-types";

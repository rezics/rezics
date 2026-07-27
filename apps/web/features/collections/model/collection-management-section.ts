import type { GetApiCollectionsByCollectionIdStatus200 } from "@rezics/openapi-tanstack-query";

export const CollectionManagementSectionIds = [
	"basic",
	"localizations",
	"items",
	"presentation",
	"access",
	"history",
] as const;
export type CollectionManagementSectionId = (typeof CollectionManagementSectionIds)[number];

type CollectionCapabilities = GetApiCollectionsByCollectionIdStatus200["capabilities"];

export function getCollectionManagementSectionIds(
	capabilities: CollectionCapabilities,
): CollectionManagementSectionId[] {
	return CollectionManagementSectionIds.filter((sectionId) => {
		if (sectionId === "basic") return capabilities.canEditDetails || capabilities.canDelete;
		if (sectionId === "localizations") return capabilities.canManageLocalizations;
		if (sectionId === "items") return capabilities.canManageItems;
		if (sectionId === "presentation") return capabilities.canEditPresentation;
		if (sectionId === "access") return capabilities.canManageAccess;
		return capabilities.canViewHistory;
	});
}

export function canOpenCollectionManagement(capabilities: CollectionCapabilities): boolean {
	return getCollectionManagementSectionIds(capabilities).length > 0;
}

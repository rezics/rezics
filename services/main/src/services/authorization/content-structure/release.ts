import type { UnitKind } from "../../database/schema";

/**
 * Returns whether the generic Content Structure API is released for this
 * combination of Unit kind and caller capability.
 */
export function canAccessContentStructureApi(
	unitKind: UnitKind,
	hasDevelopmentPreviewAccess: boolean,
): boolean {
	return (unitKind !== "media" && unitKind !== "software") || hasDevelopmentPreviewAccess;
}

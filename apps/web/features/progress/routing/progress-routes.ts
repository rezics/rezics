import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";

export function unitProgressHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/progress`;
}

export function progressEntryReviewHref(
	type: CatalogDetailUnitType,
	unitId: string,
	entryId: string,
): string {
	const search = new URLSearchParams({ progressEntryId: entryId });
	return `/units/${type}/${unitId}/reviews/new?${search}`;
}
